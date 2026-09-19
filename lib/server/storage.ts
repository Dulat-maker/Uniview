// JSON file cache that works both locally and on Vercel.
//
// - Writes go to `.cache/` locally. On Vercel the deployment is read-only except the temp dir,
//   so they go to /tmp there (kept only while that function instance lives).
// - Reads check that write dir first, then `data/seed/`: pre-computed demo profiles, travel
//   lookups and the price table committed to the repo (`npm run seed`), so the demo
//   universities open instantly on a fresh deployment. next.config.ts bundles `data/seed`.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const WRITE_DIR =
  process.env.UNIVIEW_CACHE_DIR ??
  (process.env.VERCEL ? path.join(os.tmpdir(), "uniview-cache") : path.join(process.cwd(), ".cache"));
export const SEED_DIR = path.join(process.cwd(), "data", "seed");

async function readFrom<T>(dir: string, file: string): Promise<T | undefined> {
  try {
    return JSON.parse(await readFile(path.join(dir, file), "utf8")) as T;
  } catch {
    return undefined;
  }
}

/** `file` is relative, e.g. "profiles/Q49108-en.json". Fresh cache first, then the committed seed. */
export async function readJson<T>(file: string): Promise<T | undefined> {
  return (await readFrom<T>(WRITE_DIR, file)) ?? (await readFrom<T>(SEED_DIR, file));
}

/** Best effort: a failed write (read-only disk, quota) only means the next request recomputes. */
export async function writeJson(file: string, data: unknown) {
  try {
    const full = path.join(WRITE_DIR, file);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, JSON.stringify(data));
  } catch {
    // ignore
  }
}
