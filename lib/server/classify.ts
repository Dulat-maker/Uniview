// Rule-based relevance, verification score and categories (free, no AI model).
// Evidence comes from Commons metadata: categories, titles, descriptions and geotags.
import type { PhotoCategory, PhotoStatus, PhotoTag, Reason, Season, TimeOfDay } from "@/lib/types";
import type { CommonsFile } from "./commons";
import { haversineKm } from "./http";

export type SourceKind =
  | "wikidata_image"
  | "university_category"
  | "university_subcategory"
  | "city_category"
  | "geo_search"
  | "city_geo_search"
  | "text_search"
  | "sports_venue";

export type Hit = { file: CommonsFile; sources: { kind: SourceKind; detail?: string }[] };

const SOURCE_SCORE: Record<SourceKind, number> = {
  wikidata_image: 0.75,
  university_category: 0.6,
  university_subcategory: 0.5,
  city_category: 0.6,
  geo_search: 0.3,
  city_geo_search: 0.3,
  text_search: 0.15,
  // Wikidata says this venue belongs to the university, so its own category is solid evidence.
  sports_venue: 0.65,
};

const CITY_SOURCES: SourceKind[] = ["city_category", "city_geo_search"];

// ---- keyword rules (English + Russian, matched on lower-cased text) ----
const DORMITORY = /dormitor|residence hall|hall of residence|halls of residence|student housing|student residence|student village|общежити|студенческий городок|кампус проживания/;
const LIBRARY = /librar|\blib\b(?!\s*dem)|reading room|библиотек|читальн/;
const CLASSROOM = /lecture hall|lecture theat|lecture room|auditorium|classroom|seminar room|class room|аудитори|лекционн|учебный класс/;
// Careful with substrings: "sport" is inside "transport", "graph" inside "photograph".
// \b is ASCII-only in JS, so Cyrillic words use a (?<![а-я]) lookbehind instead.
const ATHLETICS = /\bsports?\b|sporting|stadium|athlet|gymnasium|\bgym\b|\barena\b|swimming|\bpool\b|football|soccer|basketball|volleyball|hockey|\browing\b|\browers?\b|\bboat race\b|boathouse|tennis|track and field|ice rink|\brink\b|skating|(?<![а-я])спорт|(?<![а-я])каток|стадион|бассейн|футбол|баскетбол|хоккей/;
// A photo counts as "labs" from its description alone only if it names a laboratory outright
// ("…media lab…" in a conference portrait's caption is not enough).
const LABS_STRONG_DESCRIPTION = /laborator|лаборатор/;
const LABS = /laborator|\blabs?\b|research (center|centre|institute|facility|building)|cleanroom|observatory|reactor|лаборатор|научно-исследовательск|обсерватори/;
const STUDENT_LIFE = /student|commencement|graduation|convocation|festival|concert|cafeteria|dining|canteen|orientation|club|hackathon|студент|выпускн|фестивал|концерт|столов|посвящени/;

// Not useful as a campus photo: logos, maps, documents, portraits of people.
const IRRELEVANT = /\blogos?\b|seal of|coat of arms|emblem|\bflags? of\b|\bmaps?\b|diagram|signature|portrait|diploma|certificate|\bdocuments?\b|\bletters?\b|\bstamps?\b|\bcoins?\b|\bmedals?\b|book cover|floor plan|site plan|\bcharts?\b|\bgraphs?\b|screenshot|\bposters?\b|\bicons?\b|(?<![а-я])герб|логотип|эмблем|(?<![а-я])карта(?![а-я])|(?<![а-я])схема|портрет|(?<![а-я])печать|диплом|(?<![а-я])документ|плакат/;
const PEOPLE_CATEGORY = /\bpeople\b|alumni|faculty members|professors|rectors|presidents of|scientists|by name|выпускник|ректор|преподавател/;
// Also not campus photos, found in universities' own Commons categories during the audit:
// scanned books and bookplates, magazine covers, microscopy/science-contest images, holograms, motorsport shows.
const NOT_CAMPUS = /logotype|bookplate|ex libris|\b1[5-9]\d\d books\b|\b20\d\d books\b|book images|internet archive|magazine|newspaper|periodical|el grafico|microscop|micrograph|scientific images|holograph|motorsports?|racing automobiles|(?<![а-я])журнал|микроскоп/;
// Captions that reveal a chart, logo or diagram even when the title doesn't.
const IRRELEVANT_DESCRIPTION = /\b(charts?|infographics?|diagrams?|logotype|bookplate)\b|\blogo of\b|microscop|micrograph|\bafm\b|\bslope map\b/;
// Science-photo contests put lab samples (bacteria, organs, chemicals) into the university's
// category; keep such an image only if its title or categories show a lab, equipment or the campus.
const SCIENCE_CONTEST = /science (photo )?competition/;
const CONTEST_KEEP = /laborator|\blabs?\b|equipment|campus|building|students|лаборатор|оборудован|кампус/;
// Scans and instrument output are not photos of a place: old prints and manuscripts, archive
// documents, and images made by a microscope or a spectrometer. Universities upload plenty of them.
const OLD_PRINT = /engraving|engraved|lithograph|etching|woodcut|mezzotint|\bprints? by\b|\bplate [ivxlcd0-9]|manuscript|handwritt|typescript|title page|\bfolio\b|illuminated|watercolou?r|drawings? [(]|drawings? of|architectural drawing|drawn by|sketch by|wellcome|\bv\d{5,}\b|scanned|facsimile|\bletters? (of|from|to)\b|correspondence|\bdiplomas?\b|certificate of|charter of|\bdeed \b|(?<![\u0430-\u044f])рукопис|гравюр|литограф/;
const INSTRUMENT_IMAGE = /microscop|micrograph|\bsem images\b|\btem images\b|electron microscope|spectrogram|\bspectra\b|spectrum of|chromatograp|electrophoresis|petri dish|cell culture|crystal structure|diffraction|nanotube|nanoparticle|nanowire|herbarium|holotype|type specimen|микроскоп|спектр/;
// Photos from Geograph are always real outdoor photographs, whatever words the caption uses.
const REAL_PHOTO_SOURCE = /geograph/;
// A category that is just a person's name and also appears in the title = a portrait of that person.
const PERSON_NAME = /^[A-ZА-ЯЁ][a-zа-яё'’-]+(?: [A-ZА-ЯЁ][a-zа-яё'’-]+){1,2}$/;
const PLACE_WORD =
  /library|hall|house|college|building|cent(er|re)|street|square|park|court|chapel|church|cathedral|mosque|museum|gallery|memorial|monument|statue|sculpture|fountain|bridge|university|institute|campus|garden|river|common|lab|laboratory|boathouse|auditorium|stadium|tower|gate|dome|road|avenue|lane|station|school|faculty|department|observatory|theatre|theater|arena|pool|field|site|hotel|market|palace|plaza|библиотек|здани|корпус|улиц|проспект|площад|парк|мост|университет|институт|кампус|памятник|музей/i;

function looksLikePortrait(file: CommonsFile) {
  // Place names look like names too ("Nurly Tau", "Infinite Corridor", "Central Asia"), so require
  // the capitalised name in the title as written, and no geotag (photos of places usually have one).
  if (file.coords) return false;
  return file.categories.some((c) => PERSON_NAME.test(c) && !PLACE_WORD.test(c) && file.title.includes(c));
}

// Subcategories that never contain campus photos.
export const SKIP_SUBCATEGORY =
  /alumni|people|logo|press|publication|theses|dissertation|prize|licen[cs]e|police|spacecraft|aircraft|satellite|software|scheme|review|ring|music|audio|video|documents|archives|seal|coat of arms|map|diagram|stamps?|coins?|медал|выпускник|люди|логотип/i;
export const PRIORITY_SUBCATEGORY =
  /campus|building|dormitor|residence|housing|librar|lecture|auditorium|classroom|athlet|sport|stadium|gym|laborator|\blab\b|student|event|aerial|interior|hall|кампус|здани|общежит|библиотек|аудитор|спорт|лаборатор|студен/i;

export function normalize(text: string) {
  return text.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
}

/** Remove the institution's own names so "Sports University" doesn't tag every photo as athletics. */
function withoutNames(text: string, names: string[]) {
  let out = text;
  for (const name of names) {
    const n = normalize(name);
    if (n.length >= 6) out = out.split(n).join(" ");
  }
  return out;
}

export function mentionsAny(file: CommonsFile, names: string[]) {
  const raw = [file.title, file.description ?? "", ...file.categories].join(" ");
  const text = normalize(raw);
  return names.some((name) => {
    if (/^[A-ZА-ЯЁ]{2,6}$/.test(name)) {
      // Acronyms (MIT, КазНУ): whole word and case-sensitive to avoid false matches.
      return new RegExp(`(^|[^\\p{L}])${name}([^\\p{L}]|$)`, "u").test(raw);
    }
    const n = normalize(name);
    return n.length >= 5 && text.includes(n);
  });
}

export function isIrrelevant(file: CommonsFile) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.mime)) return true;
  if (file.width < 400 || file.height < 300) return true;
  const titleAndCats = normalize([file.title, ...file.categories].join(" \n "));
  const cats = normalize(file.categories.join(" \n "));
  return (
    IRRELEVANT.test(titleAndCats) ||
    NOT_CAMPUS.test(titleAndCats) ||
    (!REAL_PHOTO_SOURCE.test(titleAndCats) && (OLD_PRINT.test(titleAndCats) || INSTRUMENT_IMAGE.test(titleAndCats))) ||
    PEOPLE_CATEGORY.test(cats) ||
    IRRELEVANT_DESCRIPTION.test(normalize(file.description ?? "")) ||
    (SCIENCE_CONTEST.test(cats) && !CONTEST_KEEP.test(titleAndCats.replace(SCIENCE_CONTEST, " "))) ||
    looksLikePortrait(file)
  );
}

type Context = {
  universityNames: string[];
  campus?: { lat: number; lon: number };
  cityNames: string[];
  city?: { lat: number; lon: number };
};

export function isCityHit(hit: Hit) {
  return hit.sources.every((s) => CITY_SOURCES.includes(s.kind));
}

export function scoreHit(hit: Hit, ctx: Context) {
  const reasons: Reason[] = [];
  const city = isCityHit(hit);
  let score = 0;

  for (const s of hit.sources) {
    score = Math.max(score, SOURCE_SCORE[s.kind]);
    reasons.push({ code: s.kind, value: s.detail });
  }
  if (new Set(hit.sources.map((s) => s.kind)).size > 1) {
    score += 0.05;
    reasons.push({ code: "multiple_sources" });
  }

  let distanceKm: number | undefined;
  const ref = city ? (ctx.city ?? ctx.campus) : ctx.campus;
  if (hit.file.coords && ref) {
    distanceKm = Math.round(haversineKm(hit.file.coords, ref) * 10) / 10;
    if (city) {
      if (distanceKm <= 25) {
        score += 0.2;
        reasons.push({ code: "near_city", value: distanceKm });
      } else if (distanceKm > 60) {
        score -= 0.4;
        reasons.push({ code: "far_from_city", value: distanceKm });
      }
    } else if (distanceKm <= 0.5) {
      score += 0.3;
      reasons.push({ code: "near_campus", value: distanceKm });
    } else if (distanceKm <= 1.5) {
      score += 0.2;
      reasons.push({ code: "near_campus", value: distanceKm });
    } else if (distanceKm > 15) {
      score -= 0.4;
      reasons.push({ code: "far_from_campus", value: distanceKm });
    }
  } else if (!hit.file.coords) {
    reasons.push({ code: "no_location" });
  }

  if (!city && mentionsAny(hit.file, ctx.universityNames)) {
    score += 0.15;
    reasons.push({ code: "mentions_name" });
  } else if (city && mentionsAny(hit.file, ctx.cityNames)) {
    score += 0.1;
    reasons.push({ code: "mentions_city" });
  }

  const confidence = Math.round(Math.min(0.97, Math.max(0, score)) * 100) / 100;
  const status: PhotoStatus = confidence >= 0.75 ? "verified" : confidence >= 0.5 ? "likely" : "unverified";
  return { confidence, status, reasons, distanceKm };
}

const SEASON_WORDS: [Season, RegExp][] = [
  ["winter", /winter|snow|frost|(?<![а-я])зим|(?<![а-я])снег|мороз/],
  ["autumn", /autumn|\bfall foliage\b|(?<![а-я])осен|листопад/],
  ["spring", /\bspring\b|blossom|(?<![а-я])весн|цветени/],
  ["summer", /summer|(?<![а-я])лет(о|ом|а)(?![а-я])/],
];
const NIGHT_WORDS = /\bnight\b|at night|nighttime|illuminat|\bdusk\b|(?<![а-я])ноч|вечер|подсветк/;

function describe(file: CommonsFile) {
  return normalize([file.title, file.description ?? "", ...file.categories].join(" \n "));
}

/**
 * Season from explicit words, otherwise from the capture month (flipped in the southern hemisphere).
 * Upload dates are ignored: they say nothing about when the photo was taken.
 */
export function detectSeason(file: CommonsFile, lat: number | undefined): Season | undefined {
  const text = describe(file);
  for (const [season, re] of SEASON_WORDS) if (re.test(text)) return season;
  const month = Number(file.dateTaken?.slice(5, 7));
  if (!month) return undefined;
  const north: Season[] = ["winter", "winter", "spring", "spring", "spring", "summer", "summer", "summer", "autumn", "autumn", "autumn", "winter"];
  const flip: Record<Season, Season> = { winter: "summer", summer: "winter", spring: "autumn", autumn: "spring" };
  const season = north[month - 1];
  return lat !== undefined && lat < 0 ? flip[season] : season;
}

/** Night if the description says so, or the thumbnail is very dark (mean grey level < 60 of 255). */
export function detectTimeOfDay(file: CommonsFile, brightness: number | undefined): TimeOfDay | undefined {
  if (NIGHT_WORDS.test(describe(file))) return "night";
  if (brightness === undefined) return undefined;
  return brightness < 60 ? "night" : "day";
}

/** Below this the evidence is too weak to show the photo at all. */
export const MIN_CONFIDENCE = 0.25;

/**
 * How strongly a photo's metadata supports a keyword rule. The title, the file's own Commons
 * categories and the university subcategory it was found in are strong evidence (2 points each);
 * the free-text description only mentions things in passing ("…the building houses classrooms…"),
 * so it is weak (1 point) unless `strongDescription` also matches. A rule applies at 2+ points.
 */
function evidence(parts: Record<"title" | "cats" | "sub" | "desc", string>, rule: RegExp, strongDescription?: RegExp) {
  let points = 0;
  if (rule.test(parts.title)) points += 2;
  if (rule.test(parts.cats)) points += 2;
  if (rule.test(parts.sub)) points += 2;
  if (rule.test(parts.desc)) points += strongDescription?.test(parts.desc) ? 2 : 1;
  return points;
}

export function categorize(hit: Hit, universityNames: string[]): { category: PhotoCategory; tags: PhotoTag[] } {
  if (isCityHit(hit)) return { category: "city", tags: [] };
  const clean = (text: string) => withoutNames(normalize(text), universityNames);
  const f = hit.file;
  const parts = {
    title: clean(f.title),
    cats: clean(f.categories.join(" \n ")),
    sub: clean(hit.sources.filter((s) => s.kind === "university_subcategory").map((s) => s.detail ?? "").join(" \n ")),
    desc: clean(f.description ?? ""),
  };
  const has = (rule: RegExp, strong?: RegExp) => evidence(parts, rule, strong) >= 2;

  const tags: PhotoTag[] = [];
  // A venue Wikidata links to the university is a sports facility by definition.
  if (hit.sources.some((s) => s.kind === "sports_venue") || has(ATHLETICS)) tags.push("athletics");
  if (has(DORMITORY)) tags.push("dormitory");
  if (has(LABS, LABS_STRONG_DESCRIPTION)) tags.push("labs");
  if (has(STUDENT_LIFE)) tags.push("studentLife");

  // Pick the best-supported place type; ties keep the order dormitory > library > classroom.
  const candidates: [PhotoCategory, number][] = [
    ["dormitory", evidence(parts, DORMITORY)],
    ["library", evidence(parts, LIBRARY)],
    ["classroom", evidence(parts, CLASSROOM)],
  ];
  const best = candidates.reduce((a, b) => (b[1] > a[1] ? b : a));
  return { category: best[1] >= 2 ? best[0] : "campus", tags };
}
