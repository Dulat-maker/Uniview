import type { NextRequest } from "next/server";
import type { SearchResponse } from "@/lib/types";
import { Budget } from "@/lib/server/http";
import { searchUniversities } from "@/lib/server/wikidata";

export const maxDuration = 15;

const cache = new Map<string, { at: number; body: SearchResponse }>();
const TTL_MS = 60 * 60 * 1000;

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 100);
  const lang = req.nextUrl.searchParams.get("lang") === "ru" ? "ru" : "en";
  if (q.length < 2) {
    return Response.json({ error: "Query too short" }, { status: 400 });
  }

  const key = `${lang}:${q.toLowerCase()}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return Response.json(hit.body);

  const budget = new Budget(10_000);
  try {
    const { candidates, partial } = await searchUniversities(q, lang, budget);
    const body: SearchResponse = { query: q, candidates, partial };
    if (!partial) cache.set(key, { at: Date.now(), body });
    return Response.json(body);
  } catch (err) {
    console.error("search failed", q, err);
    return Response.json({ error: "Open data sources did not respond" }, { status: 502 });
  } finally {
    budget.dispose();
  }
}
