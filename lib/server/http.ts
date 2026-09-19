// Server-only helpers: time budget, polite fetching and small concurrency control.

// Wikimedia rate limits (mediawiki.org/wiki/Wikimedia_APIs/Rate_limits):
// - no contact info in the User-Agent → treated as unidentified: 10 requests/min
// - User-Agent with a URL or email → 200 requests/min
// - keep at most 3 concurrent requests
// Set WIKIMEDIA_CONTACT (a URL and/or email) in frontend/.env.local.
const contact = process.env.WIKIMEDIA_CONTACT;
if (!contact) {
  console.warn("[uniview] WIKIMEDIA_CONTACT is not set: Wikimedia will allow only ~10 requests/min.");
}
// The contact goes to Wikimedia only (the user agreed to that); other open-data APIs get a generic agent.
const WIKIMEDIA_USER_AGENT = `Uniview/0.1 (${contact ?? "no contact configured"}) node-fetch`;
const GENERIC_USER_AGENT = "Uniview/0.1 (hackathon project; open-data university profiles) node-fetch";
const isWikimedia = (url: string) => /(wikipedia|wikidata|wikimedia)\.org$/.test(new URL(url).host);
const userAgentFor = (url: string) => (isWikimedia(url) ? WIKIMEDIA_USER_AGENT : GENERIC_USER_AGENT);

class Semaphore {
  private active = 0;
  private queue: (() => void)[] = [];
  constructor(private readonly limit: number) {}

  async acquire(signal: AbortSignal) {
    if (this.active < this.limit) {
      this.active++;
      return;
    }
    signal.throwIfAborted();
    await new Promise<void>((resolve, reject) => {
      const grant = () => {
        signal.removeEventListener("abort", onAbort);
        resolve();
      };
      const onAbort = () => {
        this.queue = this.queue.filter((g) => g !== grant);
        reject(signal.reason);
      };
      this.queue.push(grant);
      signal.addEventListener("abort", onAbort, { once: true });
    });
    this.active++;
  }

  release() {
    this.active--;
    this.queue.shift()?.();
  }
}

// One gate per process for the Wikimedia APIs, one for Wikimedia image files, and one for
// other free APIs (Open-Meteo, Overpass, World Bank) so they don't slow down photo search.
const apiGate = new Semaphore(3);
const mediaGate = new Semaphore(4);
const otherGate = new Semaphore(4);
// The public Overpass server gives each user only a couple of slots: one request at a time.
const overpassGate = new Semaphore(1);
const gateFor = (url: string) => {
  const host = new URL(url).host;
  if (/^(upload|thumb)\.wikimedia\.org$/.test(host)) return mediaGate;
  if (/(wikipedia|wikidata|wikimedia)\.org$/.test(host)) return apiGate;
  if (host === "overpass-api.de") return overpassGate;
  return otherGate;
};

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => (clearTimeout(t), reject(signal.reason)), { once: true });
  });

async function politeFetch(
  url: string,
  budget: Budget,
  timeoutMs: number,
  accept?: string,
  init?: { method: "POST"; body: URLSearchParams }
) {
  const gate = gateFor(url);
  for (let attempt = 0; ; attempt++) {
    await gate.acquire(budget.signal);
    let res: Response;
    try {
      res = await fetch(url, {
        ...init,
        headers: { "User-Agent": userAgentFor(url), ...(accept ? { Accept: accept } : {}) },
        signal: AbortSignal.any([budget.signal, AbortSignal.timeout(timeoutMs)]),
      });
    } finally {
      gate.release();
    }
    if (res.status !== 429) return res;
    // Rate limited: one short retry if the server allows it and time remains.
    const wait = Number(res.headers.get("retry-after") ?? 5) * 1000;
    const maxWait = new URL(url).host === "overpass-api.de" ? 5000 : 2000;
    if (attempt > 0 || wait > maxWait || budget.remaining() < wait + 3000) {
      throw new Error(`HTTP 429 (rate limited) for ${new URL(url).host}`);
    }
    await sleep(wait, budget.signal);
  }
}

/** A shared deadline for one request pipeline. */
export class Budget {
  private readonly deadline: number;
  private readonly controller = new AbortController();
  private readonly timer: ReturnType<typeof setTimeout>;
  readonly startedAt = Date.now();

  constructor(ms: number, parent?: AbortSignal) {
    this.deadline = this.startedAt + ms;
    this.timer = setTimeout(() => this.controller.abort(new Error("budget exceeded")), ms);
    parent?.addEventListener("abort", () => this.controller.abort(parent.reason), { once: true });
  }

  get signal() {
    return this.controller.signal;
  }

  remaining() {
    return Math.max(0, this.deadline - Date.now());
  }

  elapsed() {
    return Date.now() - this.startedAt;
  }

  get expired() {
    return this.controller.signal.aborted;
  }

  dispose() {
    clearTimeout(this.timer);
  }
}

export async function fetchJson<T>(
  url: string,
  budget: Budget,
  timeoutMs = 8000,
  init?: { method: "POST"; body: URLSearchParams }
): Promise<T> {
  const res = await politeFetch(url, budget, timeoutMs, "application/json", init);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${new URL(url).host}`);
  const data = (await res.json()) as T;
  // The MediaWiki API reports errors (e.g. "ratelimited", "maxlag") with HTTP 200 and an
  // `error` object; treat that as a failure, not as "0 results", so the profile is marked partial.
  const apiError = (data as { error?: { code?: string } } | null)?.error;
  if (apiError && typeof apiError === "object") {
    throw new Error(`API error ${apiError.code ?? "unknown"} for ${new URL(url).host}`);
  }
  return data;
}

export async function fetchBuffer(url: string, budget: Budget, timeoutMs = 3000) {
  const res = await politeFetch(url, budget, timeoutMs);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

export function buildUrl(base: string, params: Record<string, string | number | undefined>) {
  const url = new URL(base);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) url.searchParams.set(k, String(v));
  }
  return url.toString();
}

/** Run tasks with at most `limit` in flight; failures resolve to undefined. */
export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<(R | undefined)[]> {
  const results: (R | undefined)[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      try {
        results[i] = await fn(items[i]);
      } catch {
        results[i] = undefined;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export function stripHtml(value: string | undefined) {
  if (!value) return undefined;
  const text = value
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text || undefined;
}

export function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}
