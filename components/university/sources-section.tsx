"use client";

import { ExternalLink } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { Rich } from "@/components/rich-text";
import { PhotoSummary } from "@/components/university/campus-summary";
import type { UniversityProfile } from "@/lib/types";

/** End of the profile: the photo-based summary plus every source the page was built from. */
export function SourcesSection({ profile }: { profile: UniversityProfile }) {
  const { t } = useI18n();
  const s = t.profile.sources;
  const campus = profile.location.campus;

  const sources: { name: string; use: string; href?: string }[] = [
    { name: s.commons, use: s.commonsUse(profile.photos.length), href: profile.commonsCategoryUrl ?? "https://commons.wikimedia.org" },
    ...(profile.wikipedia ? [{ name: s.wikipedia, use: s.wikipediaUse, href: profile.wikipedia.url }] : []),
    { name: s.wikidata, use: s.wikidataUse, href: profile.wikidataUrl },
    ...(profile.website ? [{ name: s.website, use: s.websiteUse, href: profile.website }] : []),
    {
      name: s.osm,
      use: s.osmUse,
      href: campus
        ? `https://www.openstreetmap.org/?mlat=${campus.lat}&mlon=${campus.lon}#map=16/${campus.lat}/${campus.lon}`
        : "https://www.openstreetmap.org",
    },
    { name: s.openMeteo, use: s.openMeteoUse, href: "https://open-meteo.com/en/docs/historical-weather-api" },
    { name: s.worldBank, use: s.worldBankUse, href: "https://data.worldbank.org/indicator/PA.NUS.PPP" },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <PhotoSummary profile={profile} />
      <div className="rounded-xl border border-border bg-card p-5 text-sm">
        <p className="text-muted-foreground">{s.intro}</p>
        <ul className="mt-3 grid gap-2.5">
          {sources.map((src) => (
            <li key={src.name} className="flex flex-col">
              <a
                href={src.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-medium underline-offset-4 hover:underline"
              >
                {src.name}
                <ExternalLink className="size-3" />
              </a>
              <span className="text-muted-foreground">
                <Rich text={src.use} />
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
