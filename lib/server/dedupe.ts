// Duplicate removal: exact (Commons SHA-1) and visually near-identical (difference hash).
import sharp from "sharp";
import { Budget, fetchBuffer, mapLimit } from "./http";

/** What we measure on each small thumbnail (no AI): a 64-bit difference hash, brightness and greenery. */
export type ThumbAnalysis = {
  hash: bigint;
  /** Mean grey level 0..255; very dark images are likely night shots. */
  brightness: number;
  /** Share of clearly green pixels 0..1 (trees, lawns). */
  green: number;
};

async function analyze(buffer: Buffer): Promise<ThumbAnalysis> {
  const grey = await sharp(buffer).grayscale().resize(9, 8, { fit: "fill" }).raw().toBuffer();
  let hash = BigInt(0);
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      hash = (hash << BigInt(1)) | (grey[y * 9 + x] > grey[y * 9 + x + 1] ? BigInt(1) : BigInt(0));
    }
  }
  const brightness = grey.reduce((sum, v) => sum + v, 0) / grey.length;

  const rgb = await sharp(buffer).removeAlpha().resize(32, 24, { fit: "fill" }).raw().toBuffer();
  let greenPixels = 0;
  for (let i = 0; i < rgb.length; i += 3) {
    const [r, g, b] = [rgb[i], rgb[i + 1], rgb[i + 2]];
    if (g > 60 && g > r + 12 && g > b + 12) greenPixels++;
  }
  return { hash, brightness, green: greenPixels / (rgb.length / 3) };
}

function hamming(a: bigint, b: bigint) {
  let x = a ^ b;
  let count = 0;
  while (x) {
    count += Number(x & BigInt(1));
    x >>= BigInt(1);
  }
  return count;
}

// Commons thumbnails come in standard widths; 120px is enough for hashing.
function smallThumb(url: string) {
  return url.replace(/\/\d+px-/, "/120px-");
}

const NEAR_DUPLICATE_BITS = 6;

/**
 * Items must be sorted best-first; later near-duplicates are dropped.
 * Hashing stops when the time budget runs low (exact SHA-1 dedupe still applies).
 */
export async function removeDuplicates<T extends { sha1: string; thumbUrl: string }>(
  items: T[],
  budget: Budget,
  reserveMs = 3000
) {
  const seenSha = new Set<string>();
  const unique = items.filter((item) => {
    if (seenSha.has(item.sha1)) return false;
    seenSha.add(item.sha1);
    return true;
  });
  let removed = items.length - unique.length;

  const analysis = new Map<string, ThumbAnalysis>();
  if (budget.remaining() <= reserveMs + 1000) return { items: unique, removed, hashed: false, analysis };

  // Only the best 60 are hashed to stay polite to Wikimedia's media servers.
  const hashes = await mapLimit(unique.slice(0, 60), 4, async (item) => {
    if (budget.remaining() < reserveMs) return undefined;
    const buf = await fetchBuffer(smallThumb(item.thumbUrl), budget, Math.max(500, Math.min(3000, budget.remaining() - reserveMs)));
    const result = await analyze(buf);
    analysis.set(item.sha1, result);
    return result.hash;
  });

  const kept: T[] = [];
  const keptHashes: bigint[] = [];
  unique.forEach((item, i) => {
    const h = hashes[i];
    if (h !== undefined && keptHashes.some((k) => hamming(k, h) <= NEAR_DUPLICATE_BITS)) {
      removed++;
      return;
    }
    kept.push(item);
    if (h !== undefined) keptHashes.push(h);
  });
  return { items: kept, removed, hashed: true, analysis };
}
