"use client";

import Image from "next/image";
import { ExternalLink, MapPin } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { StatusBadge } from "@/components/status-badge";
import type { PhotoCategory, PhotoStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

// Illustrative Unsplash stock photos for the landing mock-up only.
// Real profiles show photos found and checked by the backend.
const samplePhotos: {
  id: string;
  category: PhotoCategory;
  status: PhotoStatus;
  confidence: number;
  date: string | null;
}[] = [
  { id: "1562774053-701939374585", category: "campus", status: "verified", confidence: 0.94, date: "2023-05-12" },
  { id: "1524995997946-a1c2e315a42f", category: "library", status: "verified", confidence: 0.91, date: "2022-11-03" },
  { id: "1541829070764-84a7d30dd3f3", category: "classroom", status: "likely", confidence: 0.72, date: "2021-09-20" },
  { id: "1555854877-bab0e564b8d5", category: "dormitory", status: "likely", confidence: 0.67, date: null },
  { id: "1477959858617-67f85cf4f1df", category: "city", status: "verified", confidence: 0.88, date: "2020-06-14" },
  { id: "1522202176988-66273c2fd55f", category: "campus", status: "unverified", confidence: 0.41, date: null },
];

export function ProfilePreview() {
  const { t } = useI18n();
  const p = t.preview;
  const categories = ["all", "campus", "dormitory", "classroom", "library", "city"] as const;

  return (
    <div className="flex h-full flex-col gap-3 overflow-hidden bg-background p-3 text-left md:rounded-xl md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-base font-semibold md:text-xl">{p.university}</p>
          <p className="flex items-center gap-1 text-xs text-muted-foreground md:text-sm">
            <MapPin className="size-3.5" />
            {p.location} · 24 {p.photos} · 5 {p.sourcesLabel}
          </p>
        </div>
        <span className="rounded-full border border-dashed border-border px-2.5 py-1 text-[10px] text-muted-foreground md:text-xs">
          {p.badge}
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {categories.map((c, i) => (
          <span
            key={c}
            className={cn(
              "rounded-full px-2.5 py-1 text-[11px] font-medium md:text-xs",
              i === 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            )}
          >
            {t.categories[c]}
          </span>
        ))}
        <span className="mx-1 hidden w-px bg-border md:block" />
        {(["athletics", "dormitory", "labs", "studentLife"] as const).map((f) => (
          <span
            key={f}
            className="hidden rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground md:inline"
          >
            # {t.filters[f]}
          </span>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-2 gap-2 md:grid-cols-3 md:gap-3">
        {samplePhotos.map((photo) => (
          <figure key={photo.id} className="relative min-h-0 overflow-hidden rounded-lg bg-muted">
            <Image
              src={`https://images.unsplash.com/photo-${photo.id}?auto=format&fit=crop&w=800&q=70`}
              alt={t.categories[photo.category]}
              fill
              sizes="(max-width: 768px) 50vw, 320px"
              className="object-cover"
              draggable={false}
            />
            <StatusBadge
              status={photo.status}
              confidence={photo.confidence}
              className="absolute left-1.5 top-1.5"
            />
            <figcaption className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/75 to-transparent px-2 pb-1.5 pt-5 text-[10px] text-white md:text-xs">
              <span className="truncate">
                {t.categories[photo.category]} · {photo.date ?? p.dateUnknown}
              </span>
              <span className="flex shrink-0 items-center gap-0.5 opacity-90">
                Unsplash <ExternalLink className="size-3" />
              </span>
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
