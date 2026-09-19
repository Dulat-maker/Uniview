// Deployment self-check: is the Wikimedia contact configured, and does Wikidata answer from here?
// Reports only booleans and status codes, never the contact value itself.
import { Budget, fetchJson } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export async function GET() {
  const budget = new Budget(8000);
  const started = Date.now();
  let wikidata: string;
  try {
    await fetchJson("https://www.wikidata.org/w/api.php?action=wbgetentities&ids=Q42&props=labels&languages=en&format=json", budget);
    wikidata = "ok";
  } catch (err) {
    wikidata = err instanceof Error ? err.message : "failed";
  } finally {
    budget.dispose();
  }
  return Response.json({
    wikimediaContactConfigured: !!process.env.WIKIMEDIA_CONTACT,
    wikidata,
    wikidataMs: Date.now() - started,
    region: process.env.VERCEL_REGION ?? "local",
  });
}
