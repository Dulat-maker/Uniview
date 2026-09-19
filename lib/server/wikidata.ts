// University lookup via Wikidata + Wikipedia (free, no API key).
import type { UniversityCandidate } from "@/lib/types";
import { Budget, buildUrl, fetchJson, mapLimit } from "./http";

const WIKIDATA_API = "https://www.wikidata.org/w/api.php";
export type Lang = "en" | "ru";

// "instance of" values that clearly mean a higher-education institution.
const UNIVERSITY_TYPES = new Set([
  "Q3918", // university
  "Q38723", // higher education institution
  "Q875538", // public university
  "Q902104", // private university
  "Q15936437", // research university
  "Q62078547", // public research university
  "Q3354859", // collegiate university
  "Q1371037", // institute of technology
  "Q189004", // college
  "Q1055028", // college of a collegiate university
  "Q1321960", // law school
  "Q265662", // national university
  "Q23002054", // private not-for-profit educational institution
]);

const EDU_DESCRIPTION =
  /universit|institute|college|academy|polytechnic|conservatory|higher education|school of|университет|институт|академи|колледж|вуз|высшее учебное|политехни|консерватори|филиал/i;
const NOT_EDU_DESCRIPTION =
  /press|publish|journal|article|library|team|club|hospital|museum|album|film|station|airport|footballer|politician|family name|given name|wikimedia|category|disambiguation|licen[cs]e|software|repository|лицензи|репозитори|программн|издательств|журнал|статья|библиотек|команда|клуб|больниц|музей|страница значений/i;

type Snak = {
  mainsnak: { datavalue?: { value: unknown } };
  rank?: "preferred" | "normal" | "deprecated";
  qualifiers?: Record<string, Snak["mainsnak"][]>;
};
type Entity = {
  id: string;
  missing?: string;
  labels?: Record<string, { value: string }>;
  descriptions?: Record<string, { value: string }>;
  aliases?: Record<string, { value: string }[]>;
  claims?: Record<string, Snak[]>;
  sitelinks?: Record<string, { title: string }>;
};

function pick(map: Record<string, { value: string }> | undefined, lang: Lang) {
  return map?.[lang]?.value ?? map?.en?.value ?? map?.ru?.value ?? map?.kk?.value;
}

function claimValues<T>(entity: Entity, prop: string): T[] {
  return (entity.claims?.[prop] ?? [])
    .map((c) => c.mainsnak.datavalue?.value as T | undefined)
    .filter((v): v is T => v !== undefined);
}

function claimIds(entity: Entity, prop: string) {
  return claimValues<{ id: string }>(entity, prop).map((v) => v.id);
}

/**
 * The current value of a claim that changes over time (country, currency): skip deprecated
 * claims and ones with an end time (P582), prefer the "preferred" rank. Tomsk State University
 * lists the Russian Empire first, then the USSR, then Russia.
 */
function currentClaimId(entity: Entity, prop: string) {
  const all = entity.claims?.[prop] ?? [];
  const current = all.filter((c) => c.rank !== "deprecated" && !c.qualifiers?.P582);
  const best = current.find((c) => c.rank === "preferred") ?? current[0] ?? all[0];
  return (best?.mainsnak.datavalue?.value as { id?: string } | undefined)?.id;
}

export function commonsFileUrl(file: string, width: number) {
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=${width}`;
}

async function getEntities(ids: string[], props: string, budget: Budget, extra: Record<string, string> = {}) {
  const out: Record<string, Entity> = {};
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += 50) chunks.push(ids.slice(i, i + 50));
  const results = await mapLimit(chunks, 3, async (chunk) => {
    const data = await fetchJson<{ entities: Record<string, Entity> }>(
      buildUrl(WIKIDATA_API, {
        action: "wbgetentities",
        ids: chunk.join("|"),
        props,
        languages: "en|ru|kk",
        format: "json",
        ...extra,
      }),
      budget
    );
    Object.assign(out, data.entities);
    return true;
  });
  // A failed request must not look like "this item doesn't exist" (that would say "not found").
  if (results.some((r) => r === undefined)) throw new Error("Wikidata request failed");
  return out;
}

// People and buildings often mention a university in their description ("professor (MSU, 1990)",
// "main building of Moscow State University"), so they must never pass the description check.
const NOT_UNIVERSITY_TYPES = new Set([
  "Q5", // human
  "Q41176", // building
  "Q811979", // architectural structure
  "Q2319498", // landmark
]);
const BUILDING_DESCRIPTION = /\bbuilding\b|здание/i;

function isUniversity(entity: Entity, description?: string) {
  const types = claimIds(entity, "P31");
  if (types.some((id) => NOT_UNIVERSITY_TYPES.has(id))) return false;
  if (types.some((id) => UNIVERSITY_TYPES.has(id))) return true;
  const desc = description ?? pick(entity.descriptions, "en") ?? "";
  return EDU_DESCRIPTION.test(desc) && !NOT_EDU_DESCRIPTION.test(desc) && !BUILDING_DESCRIPTION.test(desc);
}

type SearchHit = { id: string; description?: string };

async function wikidataSearch(q: string, lang: Lang, budget: Budget): Promise<SearchHit[]> {
  const data = await fetchJson<{ search: { id: string; description?: string }[] }>(
    buildUrl(WIKIDATA_API, {
      action: "wbsearchentities",
      search: q,
      language: lang,
      uselang: lang,
      type: "item",
      limit: 12,
      format: "json",
    }),
    budget
  );
  return data.search.map((s) => ({ id: s.id, description: s.description }));
}

// Wikipedia full-text search also follows redirects, so nicknames such as
// "KazNU" or "КазНУ" resolve to the right article and its Wikidata item.
async function wikipediaSearch(q: string, lang: Lang, budget: Budget): Promise<SearchHit[]> {
  const data = await fetchJson<{
    query?: { pages: { index: number; description?: string; pageprops?: { wikibase_item?: string } }[] };
  }>(
    buildUrl(`https://${lang}.wikipedia.org/w/api.php`, {
      action: "query",
      generator: "search",
      gsrsearch: q,
      gsrlimit: 8,
      prop: "pageprops|description",
      ppprop: "wikibase_item",
      redirects: 1,
      format: "json",
      formatversion: 2,
    }),
    budget
  );
  return (data.query?.pages ?? [])
    .sort((a, b) => a.index - b.index)
    .filter((p) => p.pageprops?.wikibase_item)
    .map((p) => ({ id: p.pageprops!.wikibase_item!, description: p.description }));
}

// Cheap city guess for the result list (no extra lookups): "location" first, then "located in".
const cityIdOf = (e: Entity) => claimIds(e, "P276")[0] ?? claimIds(e, "P159")[0] ?? claimIds(e, "P131")[0];

export async function searchUniversities(q: string, lang: Lang, budget: Budget) {
  const other: Lang = lang === "en" ? "ru" : "en";
  const lists = await mapLimit(
    [
      () => wikipediaSearch(q, lang, budget),
      () => wikidataSearch(q, lang, budget),
      () => wikipediaSearch(q, other, budget),
      () => wikidataSearch(q, other, budget),
    ],
    4,
    (task) => task()
  );
  const partial = lists.some((l) => l === undefined);

  // Interleave the lists so the best hit of every source comes first.
  const hits = new Map<string, SearchHit>();
  const maxLen = Math.max(0, ...lists.map((l) => l?.length ?? 0));
  for (let i = 0; i < maxLen; i++) {
    for (const list of lists) {
      const hit = list?.[i];
      if (hit && !hits.has(hit.id)) hits.set(hit.id, hit);
    }
  }

  // Skip items whose description already says they aren't a university
  // (cities, people, songs) so we don't download their huge claim lists.
  const toCheck = [...hits.values()]
    .filter((h) => !h.description || EDU_DESCRIPTION.test(h.description))
    .map((h) => h.id);
  if (toCheck.length === 0) return { candidates: [], partial };

  const entities = await getEntities(toCheck, "labels|descriptions|claims", budget);
  const universities = toCheck
    .map((id) => entities[id])
    .filter((e): e is Entity => !!e && !e.missing && isUniversity(e, hits.get(e.id)?.description))
    .slice(0, 10);

  const placeIds = [
    ...new Set(universities.flatMap((e) => [cityIdOf(e), currentClaimId(e, "P17")].filter((id): id is string => !!id))),
  ];
  const places = placeIds.length ? await getEntities(placeIds, "labels", budget).catch(() => ({})) : {};
  const placeLabel = (id?: string) => (id ? pick((places as Record<string, Entity>)[id]?.labels, lang) : undefined);

  const candidates: UniversityCandidate[] = universities.map((e) => {
    const image = claimValues<string>(e, "P154")[0] ?? claimValues<string>(e, "P18")[0];
    return {
      qid: e.id,
      label: pick(e.labels, lang) ?? e.id,
      description: pick(e.descriptions, lang),
      city: placeLabel(cityIdOf(e)),
      country: placeLabel(currentClaimId(e, "P17")),
      imageUrl: image ? commonsFileUrl(image, 120) : undefined,
    };
  });
  return { candidates, partial };
}

// "instance of" values for real settlements, so a county or state isn't used as "the city".
const SETTLEMENT_TYPES = new Set([
  "Q515", // city
  "Q1549591", // big city
  "Q1093829", // city of the United States
  "Q7930989", // city/town
  "Q5119", // capital
  "Q3957", // town
  "Q486972", // human settlement
  "Q532", // village
  "Q1637706", // city with millions of inhabitants
  "Q200250", // metropolis
]);
const SETTLEMENT_DESCRIPTION = /\b(city|town|capital|village|metropolis)\b|город|столица|посёлок|село/i;
const REGION_DESCRIPTION = /county|state of|province|region|oblast|область|графство|регион|штат|провинц/i;

function isSettlement(entity: Entity | undefined) {
  if (!entity || entity.missing) return false;
  if (claimIds(entity, "P31").some((id) => SETTLEMENT_TYPES.has(id))) return true;
  const desc = pick(entity.descriptions, "en") ?? "";
  return SETTLEMENT_DESCRIPTION.test(desc) && !REGION_DESCRIPTION.test(desc);
}

export type UniversityInfo = {
  qid: string;
  label: string;
  description?: string;
  names: string[];
  website?: string;
  coords?: { lat: number; lon: number };
  coordsSource?: "wikidata" | "wikipedia";
  commonsCategory?: string;
  image?: string;
  logo?: string;
  founded?: string;
  students?: number;
  country?: string;
  /** ISO 3166-1 alpha-2 code of the country (Wikidata P297), e.g. "KZ". */
  countryIso2?: string;
  /** Wikidata item of the country's current currency (P38), e.g. Q173117 (tenge). */
  currencyQid?: string;
  city?: { qid: string; label: string; names: string[]; coords?: { lat: number; lon: number }; commonsCategory?: string };
  wikipedia?: { title: string; url: string; extract?: string; lang: string };
};

type GlobeCoordinate = { latitude: number; longitude: number };

function coordsOf(entity: Entity) {
  const c = claimValues<GlobeCoordinate>(entity, "P625")[0];
  return c ? { lat: c.latitude, lon: c.longitude } : undefined;
}

function commonsCategoryOf(entity: Entity) {
  const p373 = claimValues<string>(entity, "P373")[0];
  if (p373) return p373;
  const link = entity.sitelinks?.commonswiki?.title;
  return link?.startsWith("Category:") ? link.slice("Category:".length) : undefined;
}

function allNames(entity: Entity) {
  const names = new Set<string>();
  for (const l of Object.values(entity.labels ?? {})) names.add(l.value);
  for (const list of Object.values(entity.aliases ?? {})) for (const a of list) names.add(a.value);
  return [...names];
}

function latestStudentCount(entity: Entity) {
  const claims = entity.claims?.P2196 ?? [];
  let best: { amount: number; time: string } | undefined;
  for (const c of claims) {
    const amount = Number((c.mainsnak.datavalue?.value as { amount?: string } | undefined)?.amount);
    if (!Number.isFinite(amount)) continue;
    const time = (c.qualifiers?.P585?.[0]?.datavalue?.value as { time?: string } | undefined)?.time ?? "";
    if (!best || time > best.time) best = { amount, time };
  }
  return best?.amount;
}

async function wikipediaSummary(entity: Entity, lang: Lang, budget: Budget) {
  const order: Lang[] = lang === "en" ? ["en", "ru"] : ["ru", "en"];
  for (const l of order) {
    const title = entity.sitelinks?.[`${l}wiki`]?.title;
    if (!title) continue;
    try {
      const data = await fetchJson<{
        extract?: string;
        content_urls?: { desktop?: { page?: string } };
        coordinates?: { lat: number; lon: number };
      }>(`https://${l}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`, budget, 5000);
      return {
        title,
        lang: l,
        url: data.content_urls?.desktop?.page ?? `https://${l}.wikipedia.org/wiki/${encodeURIComponent(title)}`,
        extract: data.extract,
        coords: data.coordinates,
      };
    } catch {
      // try the next language
    }
  }
  return undefined;
}

export async function getUniversity(qid: string, lang: Lang, budget: Budget): Promise<UniversityInfo | null> {
  const entities = await getEntities([qid], "labels|descriptions|aliases|claims|sitelinks", budget, {
    sitefilter: "enwiki|ruwiki|commonswiki",
  });
  const e = entities[qid];
  if (!e || e.missing) return null;

  // "located in" (P131) is sometimes a county (University of Cambridge → Cambridgeshire),
  // so prefer "location" (P276) / "headquarters" (P159) and keep the first real settlement.
  const placeIds = [...new Set([...claimIds(e, "P276"), ...claimIds(e, "P159"), ...claimIds(e, "P131")])].slice(0, 6);
  const countryId = currentClaimId(e, "P17");
  const toFetch = [...new Set([...placeIds, ...(countryId ? [countryId] : [])])];

  const [places, wiki] = await Promise.all([
    toFetch.length
      ? getEntities(toFetch, "labels|descriptions|aliases|claims|sitelinks", budget, {
          sitefilter: "commonswiki",
        }).catch(() => ({}) as Record<string, Entity>)
      : Promise.resolve({} as Record<string, Entity>),
    wikipediaSummary(e, lang, budget),
  ]);

  const cityId = placeIds.find((id) => isSettlement(places[id])) ?? claimIds(e, "P131")[0];
  const cityEntity = cityId ? places[cityId] : undefined;
  const inception = claimValues<{ time: string }>(e, "P571")[0]?.time;
  const website = claimValues<string>(e, "P856")[0];
  const wikidataCoords = coordsOf(e);

  return {
    qid,
    label: pick(e.labels, lang) ?? qid,
    description: pick(e.descriptions, lang),
    names: allNames(e),
    website: website && /^https?:\/\//.test(website) ? website : undefined,
    // Some items (e.g. KazNU) have no coordinates on Wikidata; Wikipedia often does.
    coords: wikidataCoords ?? wiki?.coords,
    coordsSource: wikidataCoords ? "wikidata" : wiki?.coords ? "wikipedia" : undefined,
    commonsCategory: commonsCategoryOf(e),
    image: claimValues<string>(e, "P18")[0],
    logo: claimValues<string>(e, "P154")[0],
    founded: inception?.match(/^[+-]?(\d{4})/)?.[1],
    students: latestStudentCount(e),
    country: countryId ? pick(places[countryId]?.labels, lang) : undefined,
    countryIso2: countryId && places[countryId] ? claimValues<string>(places[countryId], "P297")[0] : undefined,
    currencyQid: countryId && places[countryId] ? currentCurrencyId(places[countryId]) : undefined,
    city:
      cityEntity && cityId
        ? {
            qid: cityId,
            label: pick(cityEntity.labels, lang) ?? cityId,
            names: allNames(cityEntity),
            coords: coordsOf(cityEntity),
            commonsCategory: commonsCategoryOf(cityEntity),
          }
        : undefined,
    wikipedia: wiki ? { title: wiki.title, url: wiki.url, extract: wiki.extract, lang: wiki.lang } : undefined,
  };
}

/** The country's current currency: not deprecated, no end date (P582), preferred rank first. */
function currentCurrencyId(country: Entity) {
  return currentClaimId(country, "P38");
}

const currencyCodes = new Map<string, string | undefined>();

/** ISO 4217 code (P498) of a currency item, e.g. Q173117 → "KZT". */
export async function currencyCode(qid: string, budget: Budget) {
  if (currencyCodes.has(qid)) return currencyCodes.get(qid);
  const entities = await getEntities([qid], "claims", budget);
  const code = entities[qid] ? claimValues<string>(entities[qid], "P498")[0] : undefined;
  const valid = code && /^[A-Z]{3}$/.test(code) ? code : undefined;
  currencyCodes.set(qid, valid);
  return valid;
}
