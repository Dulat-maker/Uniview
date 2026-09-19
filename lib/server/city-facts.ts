// Climate, transport and price level from free open-data APIs (no keys needed).
import type { CityFacts, Dorm, LatLon } from "@/lib/types";
import { Budget, buildUrl, fetchJson, haversineKm } from "./http";
import { getPriceTable } from "./prices";
import { currencyCode } from "./wikidata";

const safe = <T>(p: Promise<T>) => p.catch(() => undefined);

/** Monthly averages over the last 5 full years of ERA5 reanalysis (Open-Meteo archive). */
async function climate(coords: LatLon, budget: Budget): Promise<CityFacts["climate"]> {
  const lastYear = new Date().getFullYear() - 1;
  const firstYear = lastYear - 4;
  const data = await fetchJson<{
    daily?: { time: string[]; temperature_2m_mean: (number | null)[]; precipitation_sum: (number | null)[] };
  }>(
    buildUrl("https://archive-api.open-meteo.com/v1/archive", {
      latitude: coords.lat.toFixed(4),
      longitude: coords.lon.toFixed(4),
      start_date: `${firstYear}-01-01`,
      end_date: `${lastYear}-12-31`,
      daily: "temperature_2m_mean,precipitation_sum",
      timezone: "auto",
    }),
    budget,
    8000
  );
  const d = data.daily;
  if (!d?.time.length) return undefined;

  const temp = Array.from({ length: 12 }, () => ({ sum: 0, n: 0 }));
  const rain = Array.from({ length: 12 }, () => 0);
  d.time.forEach((day, i) => {
    const m = Number(day.slice(5, 7)) - 1;
    const t = d.temperature_2m_mean[i];
    const p = d.precipitation_sum[i];
    if (t !== null) {
      temp[m].sum += t;
      temp[m].n++;
    }
    if (p !== null) rain[m] += p;
  });
  const years = lastYear - firstYear + 1;
  return {
    years: `${firstYear}–${lastYear}`,
    months: temp.map((x, m) => ({
      t: x.n ? Math.round((x.sum / x.n) * 10) / 10 : NaN,
      p: Math.round(rain[m] / years),
    })),
  };
}

type OsmElement = { lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> };

type OsmFeature = { tags: Record<string, string>; distanceM: number };

const isStation = (t: Record<string, string>) =>
  /^(station|halt|tram_stop)$/.test(t.railway ?? "") || /^(subway|light_rail)$/.test(t.station ?? "");
const isStop = (t: Record<string, string>) => t.highway === "bus_stop" || t.public_transport === "platform";
const isDorm = (t: Record<string, string>) =>
  t.building === "dormitory" || t.amenity === "dormitory" || t.residential === "dormitory";
const isPark = (t: Record<string, string>) => /^(park|garden)$/.test(t.leisure ?? "");

function parseTransport(features: OsmFeature[]): CityFacts["transport"] {
  const sorted = [...features].sort((a, b) => a.distanceM - b.distanceM);
  const stops = sorted.filter((e) => isStop(e.tags) && !isStation(e.tags) && e.distanceM <= 1000);
  // Stops mapped twice (stop + platform) share a name; count each named stop once.
  const stopKeys = new Set(stops.map((s, i) => s.tags.name ?? `#${i}`));

  const stations: NonNullable<CityFacts["transport"]>["stations"] = [];
  for (const e of sorted.filter((x) => isStation(x.tags) && x.distanceM <= 1500)) {
    const kind = e.tags.station === "subway" ? "subway" : e.tags.railway === "tram_stop" || e.tags.station === "light_rail" ? "tram" : "rail";
    if (stations.some((s) => s.name === e.tags.name && s.kind === kind)) continue;
    stations.push({ name: e.tags.name, kind, distanceM: e.distanceM });
    if (stations.length === 4) break;
  }
  return {
    stops1km: stopKeys.size,
    nearestStop: stops[0] ? { name: stops[0].tags.name, distanceM: stops[0].distanceM } : undefined,
    stations,
  };
}

function parseDorms(features: OsmFeature[]): CityFacts["dorms"] {
  const list: Dorm[] = [];
  let unnamed = 0;
  for (const { tags, distanceM } of [...features].sort((a, b) => a.distanceM - b.distanceM)) {
    const name = tags.name ?? tags["name:ru"] ?? tags["name:en"];
    if (!name) {
      unnamed++;
      continue;
    }
    if (list.some((d) => d.name === name)) continue; // the same dorm mapped twice
    list.push({
      name,
      nameEn: tags["name:en"],
      nameRu: tags["name:ru"],
      distanceM,
      internet: tags.internet_access,
      internetFee: tags["internet_access:fee"],
      website: tags.website ?? tags["contact:website"],
      phone: tags.phone ?? tags["contact:phone"],
    });
  }
  return { list: list.slice(0, 25), unnamed };
}

/**
 * Everything from OpenStreetMap in ONE Overpass request (the public server allows very few
 * parallel requests per user): counts of everyday places within 1 km, parks, dorms within
 * 3 km and public transport around the campus.
 */
async function osm(coords: LatLon, budget: Budget): Promise<Pick<CityFacts, "transport" | "amenities" | "dorms"> | undefined> {
  const at = `${coords.lat},${coords.lon}`;
  const query = `[out:json][timeout:10];
    nwr(around:1000,${at})[amenity~"^(cafe|restaurant|fast_food)$"];out count;
    nwr(around:1000,${at})[shop~"^(supermarket|convenience|greengrocer)$"];out count;
    nwr(around:1000,${at})[amenity=pharmacy];out count;
    nwr(around:1000,${at})[leisure~"^(fitness_centre|sports_centre|stadium)$"];out count;
    (
      nwr(around:1000,${at})[leisure~"^(park|garden)$"];
      nwr(around:3000,${at})[building=dormitory];
      nwr(around:3000,${at})[amenity=dormitory];
      nwr(around:3000,${at})[residential=dormitory];
      nwr(around:1000,${at})[highway=bus_stop];
      nwr(around:1000,${at})[public_transport=platform];
      nwr(around:1500,${at})[railway~"^(station|halt|tram_stop)$"];
      nwr(around:1500,${at})[station~"^(subway|light_rail)$"];
    );
    out center tags qt 400;`;
  const data = await fetchJson<{ elements: (OsmElement & { type: string })[] }>(
    "https://overpass-api.de/api/interpreter",
    budget,
    11000,
    { method: "POST", body: new URLSearchParams({ data: query }) }
  );

  const counts = data.elements.filter((e) => e.type === "count").map((e) => Number(e.tags?.total ?? 0));
  if (counts.length < 4) return undefined;

  const features: OsmFeature[] = data.elements
    .filter((e) => e.type !== "count")
    .map((e) => {
      const lat = e.lat ?? e.center?.lat;
      const lon = e.lon ?? e.center?.lon;
      if (lat === undefined || lon === undefined) return null;
      return { tags: e.tags ?? {}, distanceM: Math.round(haversineKm(coords, { lat, lon }) * 1000) };
    })
    .filter((e): e is OsmFeature => e !== null);

  const parks = features.filter((f) => isPark(f.tags) && f.distanceM <= 1000);
  return {
    transport: parseTransport(features),
    amenities: {
      food: counts[0],
      shops: counts[1],
      pharmacies: counts[2],
      sport: counts[3],
      parks: parks.length,
      nearestParkM: parks.length ? Math.min(...parks.map((f) => f.distanceM)) : undefined,
    },
    dorms: parseDorms(features.filter((f) => isDorm(f.tags))),
  };
}

/**
 * Everyday price level of the country vs the US (World Bank household-consumption PPP ÷ exchange rate),
 * its rank among all countries and the local currency. Country-wide, not city- or student-specific,
 * so the UI marks it as low confidence.
 */
async function priceLevel(iso2: string, currencyQid: string | undefined, budget: Budget): Promise<CityFacts["priceLevel"]> {
  const [table, currency] = await Promise.all([
    getPriceTable(budget),
    currencyQid ? currencyCode(currencyQid, budget).catch(() => undefined) : undefined,
  ]);
  const row = table?.find((c) => c.iso2 === iso2);
  if (!table || !row) return undefined;
  return {
    ratio: Math.round(row.ratio * 100) / 100,
    year: row.year,
    country: row.name,
    iso2,
    lcuPerUsd: row.lcuPerUsd,
    currency,
    cheaperThanShare: table.filter((c) => c.ratio > row.ratio).length / table.length,
    countries: table.length,
  };
}

export async function getCityFacts(
  campus: LatLon | undefined,
  countryIso2: string | undefined,
  currencyQid: string | undefined,
  budget: Budget
): Promise<CityFacts> {
  const [c, p, o] = await Promise.all([
    campus ? safe(climate(campus, budget)) : undefined,
    countryIso2 && /^[A-Z]{2}$/.test(countryIso2) ? safe(priceLevel(countryIso2, currencyQid, budget)) : undefined,
    campus ? safe(osm(campus, budget)) : undefined,
  ]);
  return { climate: c, priceLevel: p, transport: o?.transport, amenities: o?.amenities, dorms: o?.dorms };
}
