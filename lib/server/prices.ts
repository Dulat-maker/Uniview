// Everyday price levels of all countries from the World Bank (free, no key).
// Price level = PPP conversion factor for household consumption ÷ market exchange rate,
// i.e. how much the same basket of consumer goods and services costs compared with the US.
import type { CountryPrice } from "@/lib/types";
import { Budget, buildUrl, fetchJson } from "./http";
import { readJson, writeJson } from "./storage";

const WB = "https://api.worldbank.org/v2";
const TTL_MS = 7 * 24 * 60 * 60 * 1000;
const CACHE_FILE = "price-levels.json";

type WbRow = { country: { id: string; value: string }; date: string; value: number | null };
type WbCountry = { iso2Code: string; name: string; region: { id: string } };
type Table = { fetchedAt: number; countries: CountryPrice[] };

let memory: Table | undefined;
let pending: Promise<Table | undefined> | undefined;

async function download(budget: Budget): Promise<Table | undefined> {
  const year = new Date().getFullYear();
  const indicator = (id: string) =>
    fetchJson<[unknown, WbRow[] | null]>(
      buildUrl(`${WB}/country/all/indicator/${id}`, { format: "json", date: `${year - 8}:${year}`, per_page: 20000 }),
      budget,
      12000
    ).then((d) => (d[1] ?? []).filter((r) => r.value !== null && r.value > 0));
  const [ppp, fx, list] = await Promise.all([
    indicator("PA.NUS.PRVT.PP"),
    indicator("PA.NUS.FCRF"),
    fetchJson<[unknown, WbCountry[] | null]>(buildUrl(`${WB}/country`, { format: "json", per_page: 400 }), budget, 12000),
  ]);
  // Regions and income groups ("Europe & Central Asia", "World") are aggregates, not countries.
  const real = new Set((list[1] ?? []).filter((c) => c.region.id !== "NA").map((c) => c.iso2Code));

  const fxByKey = new Map(fx.map((r) => [`${r.country.id}|${r.date}`, r.value!]));
  const latest = new Map<string, CountryPrice>();
  for (const p of ppp) {
    if (!real.has(p.country.id)) continue;
    const rate = fxByKey.get(`${p.country.id}|${p.date}`);
    const prev = latest.get(p.country.id);
    // Rows come newest first; keep the newest year that has both numbers.
    if (!rate || (prev && prev.year >= p.date)) continue;
    latest.set(p.country.id, {
      iso2: p.country.id,
      name: p.country.value,
      ratio: Math.round((p.value! / rate) * 1000) / 1000,
      year: p.date,
      lcuPerUsd: rate,
    });
  }
  if (latest.size < 50) return undefined;
  return { fetchedAt: Date.now(), countries: [...latest.values()].sort((a, b) => a.ratio - b.ratio) };
}

/** All countries with a known price level, cheapest first. Cached for a week (memory + disk). */
export async function getPriceTable(budget: Budget): Promise<CountryPrice[] | undefined> {
  if (memory && Date.now() - memory.fetchedAt < TTL_MS) return memory.countries;
  // An older table (e.g. the committed seed) is still better than nothing if the World Bank is down.
  memory ??= await readJson<Table>(CACHE_FILE);
  if (memory && Date.now() - memory.fetchedAt < TTL_MS) return memory.countries;
  pending ??= download(budget)
    .then(async (table) => {
      if (table) {
        memory = table;
        await writeJson(CACHE_FILE, table);
      }
      return table;
    })
    .catch(() => undefined)
    .finally(() => {
      pending = undefined;
    });
  return (await pending)?.countries ?? memory?.countries;
}
