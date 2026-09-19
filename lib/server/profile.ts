// Builds a university's visual profile within the time limit:
// Wikidata/Wikipedia facts → Commons photos → verification → dedupe → categories.
import { PROFILE_VERSION, TIME_LIMIT_MS, type Photo, type ProfileStage, type UniversityProfile } from "@/lib/types";
import {
  MIN_CONFIDENCE,
  PRIORITY_SUBCATEGORY,
  SKIP_SUBCATEGORY,
  categorize,
  detectSeason,
  detectTimeOfDay,
  isIrrelevant,
  normalize,
  scoreHit,
  type Hit,
  type SourceKind,
} from "./classify";
import { filesByName, filesInCategory, filesNear, searchFiles, subcategories, type CommonsFile } from "./commons";
import { getCityFacts } from "./city-facts";
import { readJson, writeJson } from "./storage";
import { removeDuplicates } from "./dedupe";
import { Budget, haversineKm, mapLimit } from "./http";
import { commonsFileUrl, getUniversity, type Lang, type UniversityInfo } from "./wikidata";

// Leave headroom under the 30 s limit for streaming the answer to the browser.
const PIPELINE_MS = TIME_LIMIT_MS - 5_000;
const MAX_PHOTOS = 120;

export class NotFoundError extends Error {}

// ---------- cache ----------
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const PARTIAL_TTL_MS = 10 * 60 * 1000;
const memoryCache = new Map<string, { at: number; profile: UniversityProfile }>();
const inFlight = new Map<string, Promise<UniversityProfile>>();

async function readCache(key: string) {
  const hit = memoryCache.get(key);
  // Missing city facts are retried after a minute; a cut-short photo search after 10 minutes.
  const ttl = hit?.profile.partial ? PARTIAL_TTL_MS : hit?.profile.factsIncomplete ? 60_000 : CACHE_TTL_MS;
  // A cut-short profile is rebuilt at once if a complete photo search has finished meanwhile
  // (e.g. the other language's request succeeded).
  const betterPhotosReady = !!hit?.profile.partial && photoCache.has(`${hit.profile.qid}:v${PROFILE_VERSION}`);
  if (hit && !betterPhotosReady && Date.now() - hit.at < ttl) return hit.profile;
  // Complete profiles are also kept on disk (and committed as seed data) so demo universities load instantly.
  const profile = await readJson<UniversityProfile>(`profiles/${key}.json`);
  if (!profile || profile.version !== PROFILE_VERSION) return undefined; // missing or built by an older version
  memoryCache.set(key, { at: Date.now(), profile });
  return profile;
}

async function writeCache(key: string, profile: UniversityProfile) {
  memoryCache.set(key, { at: Date.now(), profile });
  if (profile.partial || profile.factsIncomplete) return;
  await writeJson(`profiles/${key}.json`, profile);
}

export async function getProfile(qid: string, lang: Lang, onStage: (stage: ProfileStage) => void) {
  const key = `${qid}-${lang}`;
  const cached = await readCache(key);
  if (cached) return cached;

  // Share one pipeline between concurrent requests (e.g. a quick page reload).
  let job = inFlight.get(key);
  if (!job) {
    job = buildProfile(qid, lang, onStage).finally(() => inFlight.delete(key));
    inFlight.set(key, job);
    job.then((p) => writeCache(key, p)).catch(() => {});
  } else {
    onStage("search");
  }
  return job;
}

// ---------- collection ----------
type Collector = {
  add: (files: CommonsFile[] | undefined, kind: SourceKind, detail?: string) => void;
  hits: Map<number, Hit>;
  failures: number;
};

function createCollector(): Collector {
  const hits = new Map<number, Hit>();
  const collector: Collector = {
    hits,
    failures: 0,
    add(files, kind, detail) {
      if (!files) {
        collector.failures++;
        return;
      }
      for (const file of files) {
        const hit = hits.get(file.pageid) ?? { file, sources: [] };
        if (!hit.sources.some((s) => s.kind === kind)) hit.sources.push({ kind, detail });
        hits.set(file.pageid, hit);
      }
    },
  };
  return collector;
}

const safe = <T>(p: Promise<T>) => p.catch(() => undefined);

function relatedToUniversity(subcat: string, uni: UniversityInfo) {
  const n = normalize(subcat);
  return uni.names.some((name) =>
    /^[A-ZА-ЯЁ]{2,6}$/.test(name) ? subcat.includes(name) : name.length >= 5 && n.includes(normalize(name))
  );
}

async function collectUniversityCategory(uni: UniversityInfo, c: Collector, budget: Budget) {
  const cat = uni.commonsCategory;
  if (!cat) return;
  const [files, subs] = await Promise.all([safe(filesInCategory(cat, 50, budget)), safe(subcategories(cat, budget))]);
  c.add(files, "university_category", cat);
  if (!subs) return;

  const rank = (s: string) => (PRIORITY_SUBCATEGORY.test(s) ? 0 : relatedToUniversity(s, uni) ? 1 : 2);
  const chosen = subs
    .filter((s) => !SKIP_SUBCATEGORY.test(s) && rank(s) < 2)
    .sort((a, b) => rank(a) - rank(b))
    .slice(0, 6);

  await mapLimit(chosen, 4, async (sub) => {
    const [subFiles, subSubs] = await Promise.all([
      safe(filesInCategory(sub, 25, budget)),
      PRIORITY_SUBCATEGORY.test(sub) ? safe(subcategories(sub, budget)) : Promise.resolve(undefined),
    ]);
    c.add(subFiles, "university_subcategory", sub);
    // One level deeper for campus-like subcategories ("Campus of X" → individual buildings).
    const deeper = (subSubs ?? []).filter((s) => !SKIP_SUBCATEGORY.test(s)).slice(0, 2);
    await mapLimit(deeper, 4, async (deep) => c.add(await safe(filesInCategory(deep, 15, budget)), "university_subcategory", deep));
  });
}

async function collectCity(uni: UniversityInfo, c: Collector, budget: Budget) {
  const city = uni.city;
  if (!city) return;
  let found = 0;
  if (city.commonsCategory) {
    const files = await safe(filesInCategory(city.commonsCategory, 30, budget));
    c.add(files, "city_category", city.commonsCategory);
    found = files?.length ?? 0;
  }
  const center = city.coords;
  if (found < 8 && center) {
    c.add(await safe(filesNear(center, 3000, 25, budget)), "city_geo_search", city.label);
  }
}

async function collect(uni: UniversityInfo, budget: Budget) {
  const c = createCollector();
  const searchNames = [...new Set([uni.label, ...uni.names.filter((n) => n.length >= 8)])].slice(0, 2);

  await Promise.all([
    collectUniversityCategory(uni, c, budget),
    uni.coords ? safe(filesNear(uni.coords, 1000, 50, budget)).then((f) => c.add(f, "geo_search")) : null,
    ...searchNames.map((name) => safe(searchFiles(name, 20, budget)).then((f) => c.add(f, "text_search", name))),
    collectCity(uni, c, budget),
    uni.image ? safe(filesByName([uni.image], budget)).then((f) => c.add(f, "wikidata_image")) : null,
  ]);
  return c;
}

// ---------- pipeline ----------
async function buildProfile(qid: string, lang: Lang, onStage: (stage: ProfileStage) => void): Promise<UniversityProfile> {
  const budget = new Budget(PIPELINE_MS);
  try {
    onStage("search");
    const uni = await getUniversity(qid, lang, budget);
    if (!uni) throw new NotFoundError(qid);

    // Photos and city facts don't depend on the UI language; reuse them when only the language changed.
    const cacheKey = `${qid}:v${PROFILE_VERSION}`;
    const cachedPart = photoCache.get(cacheKey);
    let sharedPart: SharedPart;
    if (cachedPart && Date.now() - cachedPart.at < CACHE_TTL_MS) {
      sharedPart = cachedPart.part;
      if (sharedPart.factsIncomplete) {
        // Photos are complete; only re-ask the fact sources that failed last time.
        const fresh = await getCityFacts(uni.coords, uni.countryIso2, uni.currencyQid, budget);
        const facts = { ...sharedPart.facts };
        for (const k of Object.keys(fresh) as (keyof typeof fresh)[]) {
          if (fresh[k] !== undefined) Object.assign(facts, { [k]: fresh[k] });
        }
        sharedPart = { ...sharedPart, facts, factsIncomplete: factsMissing(uni, facts) };
        photoCache.set(cacheKey, { at: cachedPart.at, part: sharedPart });
      }
    } else {
      // City facts use other APIs, so they run alongside the photo search.
      const [photoPart, facts] = await Promise.all([
        findPhotos(uni, budget, onStage),
        getCityFacts(uni.coords, uni.countryIso2, uni.currencyQid, budget),
      ]);
      // A failed fact source returns undefined (an empty result is an object), so retry it next time.
      sharedPart = { ...photoPart, facts, factsIncomplete: factsMissing(uni, facts) };
      if (!photoPart.partial) photoCache.set(cacheKey, { at: Date.now(), part: sharedPart });
    }

    const campus = uni.coords && uni.coordsSource ? { ...uni.coords, source: uni.coordsSource } : undefined;
    const cityCenter = uni.city?.coords ? { ...uni.city.coords, label: uni.city.label } : undefined;

    onStage("profile");
    return {
      version: PROFILE_VERSION,
      qid,
      label: uni.label,
      description: uni.description,
      city: uni.city?.label,
      country: uni.country,
      website: uni.website,
      wikidataUrl: `https://www.wikidata.org/wiki/${qid}`,
      commonsCategoryUrl: uni.commonsCategory
        ? `https://commons.wikimedia.org/wiki/Category:${encodeURIComponent(uni.commonsCategory.replace(/ /g, "_"))}`
        : undefined,
      wikipedia: uni.wikipedia,
      founded: uni.founded,
      students: uni.students,
      logoUrl: uni.logo ? commonsFileUrl(uni.logo, 120) : undefined,
      hasCoordinates: !!uni.coords,
      location: {
        campus,
        cityCenter,
        distanceToCenterKm:
          campus && cityCenter ? Math.round(haversineKm(campus, cityCenter) * 10) / 10 : undefined,
      },
      ...sharedPart,
      elapsedMs: budget.elapsed(),
      generatedAt: new Date().toISOString(),
    };
  } finally {
    budget.dispose();
  }
}

/** A fact source that should have answered didn't (an empty answer is still an object). */
function factsMissing(uni: UniversityInfo, facts: UniversityProfile["facts"]) {
  return (!!uni.coords && (!facts.climate || !facts.transport || !facts.amenities)) || (!!uni.countryIso2 && !facts.priceLevel);
}

type PhotoPart = Pick<UniversityProfile, "photos" | "stats" | "partial">;
type SharedPart = PhotoPart & Pick<UniversityProfile, "facts" | "factsIncomplete">;
const photoCache = new Map<string, { at: number; part: SharedPart }>();

async function findPhotos(uni: UniversityInfo, budget: Budget, onStage: (stage: ProfileStage) => void): Promise<PhotoPart> {
  // Collection gets most of the time; keep ~8 s for dedupe and the response.
  const collectBudget = new Budget(Math.max(4000, budget.remaining() - 8000), budget.signal);
  const collector = await collect(uni, collectBudget);
  const collectionCut = collectBudget.expired;
  collectBudget.dispose();

  onStage("verification");
  const ctx = {
    universityNames: uni.names,
    campus: uni.coords,
    cityNames: uni.city?.names ?? [],
    city: uni.city?.coords,
  };
  let irrelevant = 0;
  let lowEvidence = 0;
  const scored = [...collector.hits.values()]
    .filter((hit) => {
      if (isIrrelevant(hit.file)) {
        irrelevant++;
        return false;
      }
      return true;
    })
    .map((hit) => ({ hit, ...scoreHit(hit, ctx), sha1: hit.file.sha1, thumbUrl: hit.file.thumbUrl }))
    .filter((s) => {
      if (s.confidence < MIN_CONFIDENCE) {
        lowEvidence++;
        return false;
      }
      return true;
    })
    .sort((a, b) => b.confidence - a.confidence || b.hit.file.width * b.hit.file.height - a.hit.file.width * a.hit.file.height);

  const deduped = await removeDuplicates(scored, budget);

  onStage("categories");
  const photos: Photo[] = deduped.items.slice(0, MAX_PHOTOS).map(({ hit, confidence, status, reasons, distanceKm }) => {
    const { category, tags } = categorize(hit, uni.names);
    const f = hit.file;
    const measured = deduped.analysis.get(f.sha1);
    // The most specific Commons subcategory names the place (e.g. a particular dorm building).
    const place = [...hit.sources].reverse().find((s) => s.kind === "university_subcategory")?.detail;
    return {
      id: f.pageid,
      title: f.title,
      thumbUrl: f.thumbUrl,
      fullUrl: f.fullUrl,
      sourceUrl: f.sourceUrl,
      sourceName: "Wikimedia Commons",
      width: f.width,
      height: f.height,
      author: f.author,
      license: f.license,
      licenseUrl: f.licenseUrl,
      date: f.dateTaken ?? f.datePublished,
      dateKind: f.dateTaken ? "taken" : f.datePublished ? "published" : "unknown",
      category,
      tags,
      confidence,
      status,
      reasons,
      distanceKm,
      coords: f.coords,
      uploaded: f.datePublished,
      season: detectSeason(f, (f.coords ?? uni.coords)?.lat),
      timeOfDay: detectTimeOfDay(f, measured?.brightness),
      place,
      greenShare: measured ? Math.round(measured.green * 100) / 100 : undefined,
    };
  });

  return {
    photos,
    stats: {
      examined: collector.hits.size,
      irrelevantRemoved: irrelevant,
      duplicatesRemoved: deduped.removed,
      lowEvidenceRemoved: lowEvidence,
    },
    partial: collectionCut || collector.failures > 0 || !deduped.hashed,
  };
}
