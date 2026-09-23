// Sports venues that belong to a university (stadium, arena, sports centre, pitch) from Wikidata.
// Their own Commons categories are the best source of "Athletics" photos: the buildings themselves,
// with author, licence and geotag — unlike press photos of games, which we may not reuse at all.
import { Budget, buildUrl, fetchJson } from "./http";

export type SportsVenue = { qid: string; name: string; nameRu?: string; commonsCategory: string };

const SPARQL = "https://query.wikidata.org/sparql";
const memory = new Map<string, SportsVenue[]>();

type Binding = Record<string, { value: string } | undefined>;

/**
 * Venues linked to the university by owner (P127), operator (P137), location (P276) or part of (P361),
 * whose type is a sports venue (Q1076486) or any subclass of it.
 */
export async function findSportsVenues(uniQid: string, budget: Budget): Promise<SportsVenue[]> {
  const cached = memory.get(uniQid);
  if (cached) return cached;

  const query = `SELECT DISTINCT ?item ?en ?ru ?commons WHERE {
  VALUES ?rel { wdt:P127 wdt:P137 wdt:P276 wdt:P361 }
  ?item ?rel wd:${uniQid} .
  ?item wdt:P31 ?type .
  ?type wdt:P279* wd:Q1076486 .
  ?item wdt:P373 ?commons .
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en,ru,kk". ?item rdfs:label ?en . }
  OPTIONAL { ?item rdfs:label ?ru . FILTER(LANG(?ru) = "ru") }
} LIMIT 12`;

  const data = await fetchJson<{ results: { bindings: Binding[] } }>(
    buildUrl(SPARQL, { query, format: "json" }),
    budget,
    8000
  );

  const venues: SportsVenue[] = [];
  for (const b of data.results.bindings) {
    const qid = b.item?.value.split("/").pop();
    const name = b.en?.value;
    const commonsCategory = b.commons?.value;
    // Unlabelled items come back as their Q-id and are useless to a reader.
    if (!qid || !name || !commonsCategory || /^Q\d+$/.test(name)) continue;
    venues.push({ qid, name, nameRu: b.ru?.value, commonsCategory });
  }
  memory.set(uniQid, venues);
  return venues;
}
