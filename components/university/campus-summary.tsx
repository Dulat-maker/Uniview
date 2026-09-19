"use client";

import { BookOpen, Camera, ExternalLink } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { Highlight, Rich } from "@/components/rich-text";
import { TrustBadge, type TrustLevel } from "@/components/trust-badge";
import { photoCategories, photoTags, type UniversityProfile } from "@/lib/types";

/** Wikipedia excerpt about the university, shown near the top of the profile. */
export function WikipediaAbout({ profile }: { profile: UniversityProfile }) {
  const { t } = useI18n();
  const extract = profile.wikipedia?.extract;
  if (!extract || !profile.wikipedia) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        <BookOpen className="size-4" />
        {t.profile.fromWikipedia}
      </h3>
      <p className="mt-3 line-clamp-6 leading-relaxed">
        <Highlight text={extract} term={profile.label} />
      </p>
      <a
        href={profile.wikipedia.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline"
      >
        {t.profile.wikipedia}: {profile.wikipedia.title}
        <ExternalLink className="size-3.5" />
      </a>
      <div>
        <TrustBadge className="mt-3" level="high" source="Wikipedia" hint={t.trust.hints.wikipedia} />
      </div>
    </div>
  );
}

/** A short campus description generated only from the photos that were found (no invented facts). */
export function PhotoSummary({ profile }: { profile: UniversityProfile }) {
  const { t, locale } = useI18n();
  const s = t.profile.summary;
  const photos = profile.photos;
  const list = (items: string[]) => new Intl.ListFormat(locale, { type: "conjunction" }).format(items);
  const lower = (text: string) => text.toLocaleLowerCase(locale);

  const sentences: string[] = [];
  if (photos.length < 3) {
    sentences.push(s.none(profile.label));
  } else {
    sentences.push(s.found(photos.length, profile.label));

    const present = photoCategories.filter((c) => photos.some((p) => p.category === c));
    const missing = photoCategories.filter((c) => !present.includes(c));
    sentences.push(
      s.shows(list(present.map((c) => `${lower(t.categories[c])} (**${photos.filter((p) => p.category === c).length}**)`)))
    );
    if (missing.length) sentences.push(s.missing(list(missing.map((c) => lower(t.categories[c])))));

    const facilities = photoTags
      .map((tag) => ({ tag, n: photos.filter((p) => p.tags.includes(tag)).length }))
      .filter((f) => f.n > 0);
    if (facilities.length) {
      sentences.push(s.facilities(list(facilities.map((f) => `${lower(t.filters[f.tag])} (**${f.n}**)`))));
    }

    const count = (status: string) => photos.filter((p) => p.status === status).length;
    sentences.push(s.trust(count("verified"), count("likely"), count("unverified")));

    const years = photos.map((p) => Number(p.date?.slice(0, 4))).filter((y) => Number.isFinite(y) && y > 0);
    if (years.length) sentences.push(s.period(String(Math.min(...years)), String(Math.max(...years))));

    const nearby = photos.filter((p) => p.category !== "city" && p.distanceKm !== undefined && p.distanceKm <= 1.5).length;
    if (nearby) sentences.push(s.nearby(nearby));
  }

  // How much to trust the photo-based description depends on how many photos back it up.
  const verifiedShare = photos.length ? photos.filter((p) => p.status === "verified").length / photos.length : 0;
  const summaryTrust: TrustLevel =
    photos.length >= 20 && verifiedShare >= 0.3 ? "high" : photos.length >= 5 ? "medium" : "low";

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        <Camera className="size-4" />
        {t.profile.basedOnPhotos}
      </h3>
      <p className="mt-3 leading-relaxed">
        <Rich text={sentences.join(" ")} />
      </p>
      <TrustBadge className="mt-3" level={summaryTrust} source="Wikimedia Commons" hint={t.trust.hints.photosSummary} />
    </div>
  );
}
