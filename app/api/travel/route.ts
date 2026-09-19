// Nearest airport and railway stations for a campus point (Wikidata geo search, cached on disk).
import { Budget } from "@/lib/server/http";
import { getTravel } from "@/lib/server/travel";

export const maxDuration = 30;

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const lat = Number(params.get("lat"));
  const lon = Number(params.get("lon"));
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const budget = new Budget(25_000, request.signal);
  try {
    const travel = await getTravel({ lat, lon }, budget);
    if (!travel) return Response.json({ error: "upstream" }, { status: 502 });
    return Response.json({ travel });
  } finally {
    budget.dispose();
  }
}
