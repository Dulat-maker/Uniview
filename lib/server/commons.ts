// Photo collection from Wikimedia Commons (free, licensed, with author + date metadata).
import { Budget, buildUrl, fetchJson, stripHtml } from "./http";

const COMMONS_API = "https://commons.wikimedia.org/w/api.php";

export type CommonsFile = {
  pageid: number;
  title: string;
  thumbUrl: string;
  fullUrl: string;
  sourceUrl: string;
  width: number;
  height: number;
  mime: string;
  sha1: string;
  description?: string;
  categories: string[];
  dateTaken?: string;
  datePublished?: string;
  author?: string;
  license?: string;
  licenseUrl?: string;
  coords?: { lat: number; lon: number };
};

type ExtMeta = Record<string, { value?: unknown } | undefined>;
type ApiPage = {
  pageid: number;
  title: string;
  imageinfo?: {
    url: string;
    thumburl?: string;
    descriptionurl: string;
    width: number;
    height: number;
    mime: string;
    sha1: string;
    timestamp?: string;
    extmetadata?: ExtMeta;
  }[];
};

const META_FIELDS =
  "ImageDescription|DateTimeOriginal|DateTime|Artist|LicenseShortName|LicenseUrl|Categories|GPSLatitude|GPSLongitude";

// Commons serves thumbnails at standard widths only; 500px suits the grid.
const THUMB_WIDTH = 500;

const imageInfoParams = {
  prop: "imageinfo",
  iiprop: "url|size|mime|sha1|extmetadata|timestamp",
  iiurlwidth: THUMB_WIDTH,
  iiextmetadatafilter: META_FIELDS,
  iiextmetadatalanguage: "en",
  format: "json",
  formatversion: 2,
};

function metaString(meta: ExtMeta | undefined, key: string) {
  const v = meta?.[key]?.value;
  return typeof v === "string" || typeof v === "number" ? String(v) : undefined;
}

/** Normalise messy Commons dates to YYYY, YYYY-MM or YYYY-MM-DD. */
export function parseDate(raw: string | undefined) {
  const text = stripHtml(raw);
  const m = text?.match(/\b(1[89]\d{2}|20\d{2})(?:[-:.\/](\d{1,2})(?:[-:.\/](\d{1,2}))?)?/);
  if (!m) return undefined;
  const year = Number(m[1]);
  if (year > new Date().getFullYear() + 1) return undefined;
  const month = m[2] && Number(m[2]) >= 1 && Number(m[2]) <= 12 ? m[2].padStart(2, "0") : undefined;
  const day = month && m[3] && Number(m[3]) >= 1 && Number(m[3]) <= 31 ? m[3].padStart(2, "0") : undefined;
  return [m[1], month, day].filter(Boolean).join("-");
}

function toFile(page: ApiPage): CommonsFile | null {
  const info = page.imageinfo?.[0];
  if (!info) return null;
  const meta = info.extmetadata;
  const lat = Number(metaString(meta, "GPSLatitude"));
  const lon = Number(metaString(meta, "GPSLongitude"));
  const author = stripHtml(metaString(meta, "Artist"));
  return {
    pageid: page.pageid,
    title: page.title.replace(/^File:/, "").replace(/\.[a-z0-9]+$/i, ""),
    thumbUrl: info.thumburl ?? info.url,
    fullUrl: info.url,
    sourceUrl: info.descriptionurl,
    width: info.width,
    height: info.height,
    mime: info.mime,
    sha1: info.sha1,
    description: stripHtml(metaString(meta, "ImageDescription"))?.slice(0, 500),
    categories: (metaString(meta, "Categories") ?? "").split("|").filter(Boolean),
    dateTaken: parseDate(metaString(meta, "DateTimeOriginal")),
    datePublished: parseDate(info.timestamp),
    // Long "author" values are usually leaked licence tables, not names.
    author: author && author.length <= 80 ? author : undefined,
    license: stripHtml(metaString(meta, "LicenseShortName")),
    licenseUrl: metaString(meta, "LicenseUrl"),
    coords: Number.isFinite(lat) && Number.isFinite(lon) && (lat !== 0 || lon !== 0) ? { lat, lon } : undefined,
  };
}

async function queryFiles(params: Record<string, string | number>, budget: Budget, timeoutMs = 8000) {
  const data = await fetchJson<{ query?: { pages?: ApiPage[] } }>(
    buildUrl(COMMONS_API, { action: "query", ...imageInfoParams, ...params }),
    budget,
    timeoutMs
  );
  return (data.query?.pages ?? []).map(toFile).filter((f): f is CommonsFile => f !== null);
}

export function filesInCategory(category: string, limit: number, budget: Budget) {
  return queryFiles(
    { generator: "categorymembers", gcmtitle: `Category:${category}`, gcmtype: "file", gcmlimit: limit },
    budget
  );
}

export async function subcategories(category: string, budget: Budget) {
  const data = await fetchJson<{ query?: { categorymembers?: { title: string }[] } }>(
    buildUrl(COMMONS_API, {
      action: "query",
      list: "categorymembers",
      cmtitle: `Category:${category}`,
      cmtype: "subcat",
      cmlimit: 100,
      format: "json",
      formatversion: 2,
    }),
    budget
  );
  return (data.query?.categorymembers ?? []).map((m) => m.title.replace(/^Category:/, ""));
}

export function filesNear(coords: { lat: number; lon: number }, radiusM: number, limit: number, budget: Budget) {
  return queryFiles(
    {
      generator: "geosearch",
      ggscoord: `${coords.lat}|${coords.lon}`,
      ggsradius: radiusM,
      ggsnamespace: 6,
      ggslimit: limit,
    },
    budget
  );
}

export function searchFiles(text: string, limit: number, budget: Budget) {
  return queryFiles(
    {
      generator: "search",
      gsrsearch: `"${text.replace(/"/g, "")}" filetype:bitmap`,
      gsrnamespace: 6,
      gsrlimit: limit,
    },
    budget
  );
}

export function filesByName(names: string[], budget: Budget) {
  return queryFiles({ titles: names.map((n) => `File:${n}`).join("|") }, budget);
}
