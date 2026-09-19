"use client";

import Image from "next/image";
import { ExternalLink, MessageSquareOff, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/i18n-provider";
import { StatusBadge } from "@/components/status-badge";
import type { UniversityProfile } from "@/lib/types";

export function StudentSection({
  profile,
  onShowAll,
}: {
  profile: UniversityProfile;
  onShowAll: () => void;
}) {
  const { t } = useI18n();
  const s = t.profile.student;
  const photos = profile.photos.filter((p) => p.tags.includes("studentLife"));
  const reviewsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    [profile.label, profile.city].filter(Boolean).join(" ")
  )}`;

  return (
    <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="flex items-center gap-2 font-semibold">
          <Users className="size-5 text-muted-foreground" />
          {s.photosTitle}
        </h3>
        {photos.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">{s.noPhotos}</p>
        ) : (
          <>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {photos.slice(0, 6).map((photo) => (
                <a
                  key={photo.id}
                  href={photo.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative block aspect-[4/3] overflow-hidden rounded-lg bg-muted"
                  title={photo.title}
                >
                  <Image src={photo.thumbUrl} alt={photo.title} fill unoptimized sizes="200px" className="object-cover" />
                  <StatusBadge status={photo.status} confidence={photo.confidence} className="absolute left-1.5 top-1.5" />
                </a>
              ))}
            </div>
            {photos.length > 6 && (
              <Button variant="ghost" className="mt-2" onClick={onShowAll}>
                {s.showAll(photos.length)}
              </Button>
            )}
          </>
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-dashed border-border p-5 text-sm">
        <h3 className="flex items-center gap-2 font-semibold">
          <MessageSquareOff className="size-5 text-muted-foreground" />
          {s.reviewsTitle}
        </h3>
        <p className="text-muted-foreground">{s.reviewsText}</p>
        <a
          href={reviewsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 font-medium underline-offset-4 hover:underline"
        >
          {s.reviewsLink}
          <ExternalLink className="size-3.5" />
        </a>
      </div>
    </div>
  );
}
