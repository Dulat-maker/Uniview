// Copies complete, current-version results from the local cache (.cache/) into data/seed/,
// which is committed and bundled into the deployment, so demo universities load instantly
// on Vercel (whose disk is read-only). Run after warming the cache with `npm run dev`:
//   npm run seed
import { copyFile, mkdir, readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const cache = path.join(root, ".cache");
const seed = path.join(root, "data", "seed");
const types = await readFile(path.join(root, "lib", "types.ts"), "utf8");
const version = Number(types.match(/PROFILE_VERSION = (\d+)/)?.[1]);

async function copyWhere(dir, keep) {
  const from = path.join(cache, dir);
  const to = path.join(seed, dir);
  await rm(to, { recursive: true, force: true });
  await mkdir(to, { recursive: true });
  let copied = 0;
  let skipped = 0;
  for (const name of (await readdir(from).catch(() => [])).filter((n) => n.endsWith(".json"))) {
    const data = JSON.parse(await readFile(path.join(from, name), "utf8"));
    if (keep(data)) {
      await copyFile(path.join(from, name), path.join(to, name));
      copied++;
    } else skipped++;
  }
  console.log(`${dir}: ${copied} copied, ${skipped} skipped`);
}

await copyWhere("profiles", (p) => p.version === version && !p.partial && !p.factsIncomplete);
await copyWhere("travel", (t) => t.complete);
await mkdir(seed, { recursive: true });
await copyFile(path.join(cache, "price-levels.json"), path.join(seed, "price-levels.json")).then(
  () => console.log("price-levels.json copied"),
  () => console.log("price-levels.json: not in the cache yet (open any profile first)")
);
