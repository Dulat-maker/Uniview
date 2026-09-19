// All countries' everyday price levels (World Bank), for "compare with your home country".
import { getPriceTable } from "@/lib/server/prices";
import { Budget } from "@/lib/server/http";

export const maxDuration = 30;

export async function GET() {
  const budget = new Budget(20_000);
  try {
    const countries = await getPriceTable(budget);
    if (!countries) return Response.json({ error: "unavailable" }, { status: 503 });
    return Response.json({ countries }, { headers: { "Cache-Control": "public, max-age=86400" } });
  } finally {
    budget.dispose();
  }
}
