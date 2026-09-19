"use client";

import Image from "next/image";
import { Info } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { StatusBadge } from "@/components/status-badge";
import type { UniversityProfile } from "@/lib/types";

/** "Live" stream substitute: the newest public, licensed uploads found for this campus and city. */
export function LatestPhotos({ profile }: { profile: UniversityProfile }) {
  const { t } = useI18n();
  const l = t.profile.latest;
  const latest = profile.photos
    .filter((p) => p.uploaded)
    .sort((a, b) => (b.uploaded ?? "").localeCompare(a.uploaded ?? ""))
    .slice(0, 8);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">{l.hint}</p>
      {latest.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">{l.none}</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {latest.map((photo) => (
            <a
              key={photo.id}
              href={photo.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card"
              title={photo.title}
            >
              <span className="relative block aspect-[4/3] bg-muted">
                <Image src={photo.thumbUrl} alt={photo.title} fill unoptimized sizes="25vw" className="object-cover" />
                <StatusBadge status={photo.status} confidence={photo.confidence} className="absolute left-1.5 top-1.5" />
              </span>
              <span className="flex flex-col gap-0.5 p-2 text-xs">
                <span className="font-medium">{l.uploaded(photo.uploaded!)}</span>
                <span className="truncate text-muted-foreground">
                  {[t.categories[photo.category], photo.author].filter(Boolean).join(" · ")}
                </span>
              </span>
            </a>
          ))}
        </div>
      )}
      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        {l.socialNote}
      </p>
    </div>
  );
}
