// Shortlist sharing without accounts or a server: the list is packed into the URL *fragment*
// (after "#"), which browsers never send to the server. Whoever opens the link sees a read-only copy.
import { APPLICATION_STEPS, MY_FACT_KEYS, PRIORITIES, type SavedUniversity } from "@/lib/personal-store";

type Packed = { v: 1; items: Partial<SavedUniversity>[] };

function toBase64Url(text: string) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string) {
  const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
  return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
}

export function shareUrl(origin: string, items: SavedUniversity[], withNotes: boolean) {
  const packed: Packed = {
    v: 1,
    items: items.map((u) => ({
      qid: u.qid,
      label: u.label,
      city: u.city,
      country: u.country,
      priority: u.priority,
      step: u.step,
      tags: u.tags?.length ? u.tags : undefined,
      note: withNotes && u.note ? u.note : undefined,
      myFacts: withNotes && u.myFacts && Object.values(u.myFacts).some(Boolean) ? u.myFacts : undefined,
    })),
  };
  return `${origin}/shared#${toBase64Url(JSON.stringify(packed))}`;
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : undefined);

/** Parses and sanitises a shared list; anything malformed is dropped rather than trusted. */
export function readShared(hash: string): SavedUniversity[] | undefined {
  try {
    const data = JSON.parse(fromBase64Url(hash.replace(/^#/, ""))) as Packed;
    if (data?.v !== 1 || !Array.isArray(data.items)) return undefined;
    return data.items
      .filter((u) => typeof u.qid === "string" && /^Q\d{1,12}$/.test(u.qid) && typeof u.label === "string")
      .slice(0, 30)
      .map((u) => ({
        qid: u.qid!,
        label: str(u.label, 200)!,
        city: str(u.city, 100),
        country: str(u.country, 100),
        savedAt: new Date().toISOString(),
        note: str(u.note, 2000) ?? "",
        priority: PRIORITIES.find((p) => p === u.priority),
        step: APPLICATION_STEPS.find((s) => s === u.step),
        tags: Array.isArray(u.tags) ? u.tags.filter((x): x is string => typeof x === "string").map((x) => x.slice(0, 30)).slice(0, 8) : undefined,
        myFacts:
          u.myFacts && typeof u.myFacts === "object"
            ? Object.fromEntries(
                Object.entries(u.myFacts)
                  .filter(([k, v]) => (MY_FACT_KEYS as readonly string[]).includes(k) && typeof v === "string")
                  .map(([k, v]) => [k, (v as string).slice(0, 200)])
              )
            : undefined,
      }));
  } catch {
    return undefined;
  }
}
