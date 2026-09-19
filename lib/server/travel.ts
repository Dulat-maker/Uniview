// "Getting here": the nearest airport (with an IATA code, international first) and railway stations,
// from Wikidata's geo search. Loaded separately from the profile because the query can take 5–15 s.
import type { LatLon, TravelFacts, TravelPlace } from "@/lib/types";
import { Budget, buildUrl, fetchJson } from "./http";
import { readJson, writeJson } from "./storage";

const SPARQL = "https://query.wikidata.org/sparql";
const memory = new Map<string, TravelFacts>();

type Binding = Record<string, { value: string } | undefined>;

async function sparql(query: string, budget: Budget) {
  const data = await fetchJson<{ results: { bindings: Binding[] } }>(
    buildUrl(SPARQL, { query, format: "json" }),
    budget,
    20000
  );
  return data.results.bindings;
}

const around = (at: LatLon, km: number) => `SERVICE wikibase:around {
    ?item wdt:P625 ?loc .
    bd:serviceParam wikibase:center "Point(${at.lon} ${at.lat})"^^geo:wktLiteral .
    bd:serviceParam wikibase:radius "${km}" .
    bd:serviceParam wikibase:distance ?dist .
  }`;

const labels = `SERVICE wikibase:label { bd:serviceParam wikibase:language "en,ru,kk". ?item rdfs:label ?en . }
  OPTIONAL { ?item rdfs:label ?ru . FILTER(LANG(?ru) = "ru") }`;

function place(b: Binding): TravelPlace | undefined {
  const qid = b.item?.value.split("/").pop();
  const en = b.en?.value;
  // Unlabelled items come back as their Q-id; they are useless to a reader.
  if (!qid || !en || /^Q\d+$/.test(en)) return undefined;
  return { qid, name: en, nameRu: b.ru?.value, km: Math.round(Number(b.dist?.value) * 10) / 10, iata: b.iata?.value };
}

async function airportsWithin(at: LatLon, km: number, budget: Budget) {
  // Q644371 international airport · Q1248784 airport · Q94993988 commercial traffic aerodrome
  const rows = await sparql(
    `SELECT ?item ?en ?ru ?iata ?dist ?kind WHERE {
  ${around(at, km)}
  ?item wdt:P238 ?iata ; wdt:P31 ?kind .
  VALUES ?kind { wd:Q644371 wd:Q1248784 wd:Q94993988 }
  ${labels}
} ORDER BY ?dist LIMIT 30`,
    budget
  );
  const byQid = new Map<string, TravelPlace & { international: boolean }>();
  for (const b of rows) {
    const p = place(b);
    if (!p) continue;
    const international = b.kind?.value.endsWith("/Q644371") ?? false;
    const prev = byQid.get(p.qid);
    byQid.set(p.qid, { ...p, international: international || !!prev?.international });
  }
  return [...byQid.values()].sort((a, b) => a.km - b.km);
}

async function airports(at: LatLon, budget: Budget) {
  // The geo search scans every item in the circle, so a 100 km circle around a dense region
  // (e.g. London) takes ~30 s. Look within 40 km first and widen only if nothing international is there.
  let list = await airportsWithin(at, 40, budget);
  if (!list.some((a) => a.international)) list = await airportsWithin(at, 100, budget);
  // The nearest international airport is what an applicant flies into; a small airfield nearby isn't.
  const main = list.find((a) => a.international) ?? list[0];
  return main ? [{ ...main, international: undefined }] : [];
}

async function stations(at: LatLon, budget: Budget) {
  // Q55488 railway station · Q18543139 central station
  const rows = await sparql(
    `SELECT DISTINCT ?item ?en ?ru ?dist WHERE {
  ${around(at, 20)}
  ?item wdt:P31 ?kind .
  VALUES ?kind { wd:Q55488 wd:Q18543139 }
  FILTER NOT EXISTS { ?item wdt:P576 ?closed }
  ${labels}
} ORDER BY ?dist LIMIT 15`,
    budget
  );
  const seen = new Set<string>();
  return rows
    .map(place)
    .filter((p): p is TravelPlace => !!p && !seen.has(p.qid) && !!seen.add(p.qid))
    .slice(0, 2);
}

/** Rounded coordinates are the cache key, so nearby campuses share results. */
const keyOf = (at: LatLon) => `${at.lat.toFixed(3)}_${at.lon.toFixed(3)}`;

export async function getTravel(at: LatLon, budget: Budget): Promise<TravelFacts | undefined> {
  const key = keyOf(at);
  const cached = memory.get(key);
  if (cached) return cached;
  const file = `travel/${key}.json`;
  const disk = await readJson<TravelFacts>(file);
  if (disk) {
    memory.set(key, disk);
    return disk;
  }

  // The query service allows few parallel queries per client, so run them one after another,
  // retrying a failed one once while time remains.
  const attempt = async <T>(run: () => Promise<T>) => {
    try {
      return await run();
    } catch {
      if (budget.remaining() < 8000) return undefined;
      return run().catch(() => undefined);
    }
  };
  const airport = await attempt(() => airports(at, budget));
  const stationList = await attempt(() => stations(at, budget));
  if (!airport && !stationList) return undefined;
  const facts: TravelFacts = {
    airport: airport ? (airport[0] ?? null) : undefined,
    stations: stationList,
    complete: !!airport && !!stationList,
  };
  if (facts.complete) {
    memory.set(key, facts);
    await writeJson(file, facts);
  }
  return facts;
}
