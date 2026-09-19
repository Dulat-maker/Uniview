"use client";

import React from "react";
import { ChevronDown, ExternalLink, ImageOff } from "lucide-react";
import { Carousel360 } from "@/components/ui/image-fan-carousel";
import { useI18n } from "@/components/i18n-provider";
import { StatusBadge } from "@/components/status-badge";
import type { Photo, UniversityProfile } from "@/lib/types";

const MAX_PHOTOS = 12;

/** Campus and student-life photos we could confirm — the first thing users see on a profile. */
export function mainPhotos(profile: UniversityProfile): Photo[] {
  const candidates = profile.photos
    .filter((p) => (p.category === "campus" || p.tags.includes("studentLife")) && p.category !== "city")
    .sort((a, b) => b.confidence - a.confidence);
  // The most visible spot on the page: verified photos first; "likely" ones only fill in
  // when there are too few verified (geotag-only matches can be e.g. a plant in a nearby park).
  const verified = candidates.filter((p) => p.status === "verified");
  const likely = candidates.filter((p) => p.status === "likely");
  return (verified.length >= 6 ? verified : [...verified, ...likely]).slice(0, MAX_PHOTOS);
}

export function MainGallery({ profile }: { profile: UniversityProfile }) {
  const { t, locale } = useI18n();
  const g = t.profile.gallery;
  const photos = React.useMemo(() => mainPhotos(profile), [profile]);
  const [active, setActive] = React.useState(0);
  const current = photos[active] ?? photos[0];

  if (photos.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">
        <ImageOff className="size-5 shrink-0" />
        {g.none}
      </div>
    );
  }

  const dateLabel =
    current.dateKind === "taken"
      ? `${t.profile.taken}: ${current.date}`
      : current.dateKind === "published"
        ? `${t.profile.published}: ${current.date}`
        : t.profile.dateUnknown;

  return (
    // overflow-x-clip: the 3D ring's outer thumbnails must never widen the page.
    <div className="flex w-full flex-col items-center gap-2 overflow-x-clip">
      <p className="max-w-2xl text-center text-sm text-muted-foreground">{g.hint}</p>
      {/* Keyed by locale so the ring restarts cleanly when the profile is reloaded in another language. */}
      <Carousel360
        key={`${profile.qid}-${locale}`}
        images={photos.map((p) => p.thumbUrl)}
        alts={photos.map((p) => p.title)}
        // Commons serves standard thumbnail widths; 960px keeps the big center photo sharp
        // (smaller originals can't be upscaled by Commons, so those use the original file).
        centerImages={photos.map((p) => (p.width > 960 ? p.thumbUrl.replace(/\/\d+px-/, "/960px-") : p.fullUrl))}
        size="large"
        unoptimized
        autoplay={false}
        onActiveChange={setActive}
      />
      {/* Caption of the photo in the centre: its status, title, date and a clickable source. */}
      <div className="flex max-w-xl flex-col items-center gap-1.5 text-center text-sm" aria-live="polite">
        <div className="flex items-center gap-2">
          <StatusBadge status={current.status} confidence={current.confidence} />
          <span className="text-xs tabular-nums text-muted-foreground">{g.position(active + 1, photos.length)}</span>
        </div>
        <p className="line-clamp-1 font-medium">{current.title}</p>
        <p className="text-xs text-muted-foreground">
          {t.categories[current.category]} · {dateLabel}
          {current.author && ` · ${current.author}`}
        </p>
        <a
          href={current.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs font-medium underline-offset-4 hover:underline"
        >
          {t.profile.source}: {current.sourceName}
          <ExternalLink className="size-3" />
        </a>
      </div>
      <a
        href="#details"
        className="mt-4 flex flex-col items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        {g.scroll}
        <ChevronDown className="size-5 animate-bounce" />
      </a>
    </div>
  );
}
