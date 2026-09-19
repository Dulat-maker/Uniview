import type { CityFacts } from "@/lib/types";

export type ComfortFactorKey = "transport" | "food" | "green" | "health";
export type ComfortFactor = { key: ComfortFactorKey; points: number; max: number };

const share = (value: number, cap: number) => Math.min(value, cap) / cap;

/**
 * Urban comfort index 0–100 from OpenStreetMap counts within 1 km of the campus.
 * Transparent weights: transport 40, cafés & shops 30, parks 20, pharmacy & sport 10.
 * Rent and safety are deliberately left out: there is no open, reliable data for them.
 */
export function comfortIndex(facts: CityFacts) {
  const t = facts.transport;
  const a = facts.amenities;
  if (!t || !a) return undefined;
  const factors: ComfortFactor[] = [
    { key: "transport", max: 40, points: Math.round(share(t.stops1km, 20) * 25 + (t.stations.length ? 15 : 0)) },
    { key: "food", max: 30, points: Math.round(share(a.food, 30) * 15 + share(a.shops, 10) * 15) },
    { key: "green", max: 20, points: Math.round(share(a.parks, 5) * 20) },
    { key: "health", max: 10, points: (a.pharmacies > 0 ? 5 : 0) + (a.sport > 0 ? 5 : 0) },
  ];
  return { score: factors.reduce((sum, f) => sum + f.points, 0), factors };
}
