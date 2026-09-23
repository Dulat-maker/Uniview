// Shared between the API routes (server) and the UI (client).

/** Hard limit from the task: a result must arrive within 30 seconds. */
export const TIME_LIMIT_MS = 30_000;

export const photoCategories = ["campus", "dormitory", "classroom", "library", "city"] as const;
export type PhotoCategory = (typeof photoCategories)[number];

export const photoTags = ["athletics", "dormitory", "labs", "studentLife"] as const;
export type PhotoTag = (typeof photoTags)[number];

export type PhotoStatus = "verified" | "likely" | "unverified";

export type ReasonCode =
  | "wikidata_image"
  | "university_category"
  | "university_subcategory"
  | "city_category"
  | "geo_search"
  | "city_geo_search"
  | "text_search"
  | "sports_venue"
  | "near_campus"
  | "far_from_campus"
  | "near_city"
  | "far_from_city"
  | "mentions_name"
  | "mentions_city"
  | "multiple_sources"
  | "no_location";

export type Reason = { code: ReasonCode; value?: string | number };

export type Photo = {
  id: number;
  title: string;
  thumbUrl: string;
  fullUrl: string;
  /** Clickable source: the file page on Wikimedia Commons. */
  sourceUrl: string;
  sourceName: string;
  width: number;
  height: number;
  author?: string;
  license?: string;
  licenseUrl?: string;
  /** "YYYY", "YYYY-MM" or "YYYY-MM-DD". */
  date?: string;
  dateKind: "taken" | "published" | "unknown";
  category: PhotoCategory;
  tags: PhotoTag[];
  /** 0..1 */
  confidence: number;
  status: PhotoStatus;
  reasons: Reason[];
  distanceKm?: number;
  /** Where the photo was taken (from its geotag), if known. */
  coords?: LatLon;
  /** Upload date to the source (YYYY-MM-DD), used for "latest photos". */
  uploaded?: string;
  /** From the description or the capture month (hemisphere-aware); unknown if absent. */
  season?: Season;
  /** Estimated from the description or the thumbnail's brightness. */
  timeOfDay?: TimeOfDay;
  /** A named place (e.g. a dorm building) the photo belongs to, from its Commons subcategory. */
  place?: string;
  /** Share of green pixels (0..1) measured on the thumbnail; undefined if not measured. */
  greenShare?: number;
};

export type LatLon = { lat: number; lon: number };

export type UniversityCandidate = {
  qid: string;
  label: string;
  description?: string;
  city?: string;
  country?: string;
  imageUrl?: string;
};

export type SearchResponse = {
  query: string;
  candidates: UniversityCandidate[];
  partial: boolean;
};

/** Bump when the profile shape changes so old cache files are rebuilt. */
export const PROFILE_VERSION = 7;

/** City and living facts from free open-data APIs; each part is missing when no data was found. */
export type CityFacts = {
  /** 12 months of averages from daily weather reanalysis at the campus point. */
  climate?: { years: string; months: { t: number; p: number }[] };
  transport?: {
    stops1km: number;
    nearestStop?: { name?: string; distanceM: number };
    stations: { name?: string; kind: "rail" | "subway" | "tram"; distanceM: number }[];
  };
  /** Everyday (household consumption) price level of the country relative to the US (1 = same as US). */
  priceLevel?: {
    ratio: number;
    year: string;
    country: string;
    iso2?: string;
    /** Local currency units per US dollar, yearly average of the same year. */
    lcuPerUsd?: number;
    /** ISO 4217 code of the local currency, e.g. "KZT". */
    currency?: string;
    /** Share of countries (0..1) where everyday prices are higher. */
    cheaperThanShare?: number;
    countries?: number;
  };
  /** Everyday places within 1 km of the campus (OpenStreetMap). */
  amenities?: {
    food: number;
    shops: number;
    pharmacies: number;
    sport: number;
    parks: number;
    nearestParkM?: number;
  };
  /** Dormitories mapped in OpenStreetMap within 3 km of the campus (nearest first). */
  dorms?: {
    list: Dorm[];
    /** Dorm buildings without a name (counted, not listed). */
    unnamed: number;
  };
};

export type Dorm = {
  name: string;
  nameEn?: string;
  nameRu?: string;
  distanceM: number;
  /** OSM `internet_access` value (yes / wlan / wired / no) when mapped. */
  internet?: string;
  internetFee?: string;
  website?: string;
  phone?: string;
};

export const seasons = ["winter", "spring", "summer", "autumn"] as const;
export type Season = (typeof seasons)[number];
export type TimeOfDay = "day" | "night";

export type UniversityProfile = {
  version: number;
  qid: string;
  label: string;
  description?: string;
  city?: string;
  country?: string;
  website?: string;
  wikidataUrl: string;
  commonsCategoryUrl?: string;
  wikipedia?: { title: string; url: string; extract?: string; lang: string };
  founded?: string;
  students?: number;
  logoUrl?: string;
  hasCoordinates: boolean;
  location: {
    campus?: LatLon & { source: "wikidata" | "wikipedia" };
    cityCenter?: LatLon & { label: string };
    /** Straight-line distance from the campus point to the city's centre point. */
    distanceToCenterKm?: number;
  };
  facts: CityFacts;
  photos: Photo[];
  stats: {
    /** Unique files looked at. */
    examined: number;
    irrelevantRemoved: number;
    duplicatesRemoved: number;
    lowEvidenceRemoved: number;
  };
  /** True when the time limit or a failed source cut the search short. */
  partial: boolean;
  /** A city-facts API failed (not shown as "cut short"); such profiles aren't cached for long. */
  factsIncomplete?: boolean;
  elapsedMs: number;
  generatedAt: string;
};

export type ProfileStage = "search" | "verification" | "categories" | "profile";

export type ProfileEvent =
  | { type: "stage"; stage: ProfileStage }
  | { type: "result"; profile: UniversityProfile }
  | { type: "error"; code: "not_found" | "upstream" | "timeout"; message: string; detail?: string };

/** One country's everyday price level (World Bank), used by /api/prices and the cost-of-living card. */
export type CountryPrice = { iso2: string; name: string; ratio: number; year: string; lcuPerUsd: number };

/** An airport or railway station near the campus (Wikidata), with straight-line distance. */
export type TravelPlace = { qid: string; name: string; nameRu?: string; km: number; iata?: string };

/** How to get to the campus from out of town. Loaded separately from the profile (slow query). */
export type TravelFacts = {
  /** null = looked up, none within 100 km; undefined = the lookup failed. */
  airport?: TravelPlace | null;
  /** [] = none within 20 km; undefined = the lookup failed. */
  stations?: TravelPlace[];
  complete: boolean;
};
