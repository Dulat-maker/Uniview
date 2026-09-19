"use client";

import Image from "next/image";
import { CalendarDays, ExternalLink, Info, MessageSquare, Moon } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { StatusBadge } from "@/components/status-badge";
import type { Photo } from "@/lib/types";
import { cn } from "@/lib/utils";

export function PhotoCard({ photo, eager = false }: { photo: Photo; eager?: boolean }) {
  const { t } = useI18n();
  const dateLabel =
    photo.dateKind === "taken"
      ? `${t.profile.taken}: ${photo.date}`
      : photo.dateKind === "published"
        ? `${t.profile.published}: ${photo.date}`
        : t.profile.dateUnknown;

  return (
    <figure
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border bg-card",
        photo.status === "unverified" ? "border-amber-500/50" : "border-border"
      )}
    >
      <a
        href={photo.sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="relative block aspect-[4/3] bg-muted"
      >
        <Image
          src={photo.thumbUrl}
          alt={photo.title}
          fill
          unoptimized
          loading={eager ? "eager" : "lazy"}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-cover"
        />
        <StatusBadge status={photo.status} confidence={photo.confidence} className="absolute left-2 top-2" />
      </a>

      <figcaption className="flex flex-1 flex-col gap-2 p-3 text-sm">
        <div className="flex flex-wrap gap-1">
          <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-medium text-primary-foreground">
            {t.categories[photo.category]}
          </span>
          {photo.tags.map((tag) => (
            <span key={tag} className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
              # {t.filters[tag]}
            </span>
          ))}
          {photo.season && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
              {t.profile.seasons[photo.season]}
            </span>
          )}
          {photo.timeOfDay === "night" && (
            <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
              <Moon className="size-3" />
              {t.profile.seasons.night}
            </span>
          )}
        </div>

        <p className="line-clamp-2 font-medium" title={photo.title}>
          {photo.title}
        </p>

        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <CalendarDays className="size-3.5" />
          {dateLabel}
        </p>

        {(photo.author || photo.license) && (
          <p className="truncate text-xs text-muted-foreground" title={[photo.author, photo.license].filter(Boolean).join(" · ")}>
            {[photo.author, photo.license].filter(Boolean).join(" · ")}
          </p>
        )}

        <a
          href={photo.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs font-medium underline-offset-4 hover:underline"
        >
          {t.profile.source}: {photo.sourceName}
          <ExternalLink className="size-3" />
        </a>

        {photo.place && photo.category !== "city" && (
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
              photo.coords ? `${photo.place} ${photo.coords.lat},${photo.coords.lon}` : photo.place
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            title={t.profile.placeReviewsHint}
            className="flex items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            <MessageSquare className="size-3.5 shrink-0" />
            <span className="truncate">{t.profile.placeReviews(photo.place)}</span>
            <ExternalLink className="size-3 shrink-0" />
          </a>
        )}

        <details className="mt-auto text-xs text-muted-foreground">
          <summary className="flex cursor-pointer list-none items-center gap-1 hover:text-foreground">
            <Info className="size-3.5" />
            {t.profile.why}
          </summary>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            {photo.reasons.map((r, i) => (
              <li key={`${r.code}-${i}`}>{t.reasons[r.code](r.value)}</li>
            ))}
          </ul>
        </details>
      </figcaption>
    </figure>
  );
}
