"use client";

import dynamic from "next/dynamic";
import { ExternalLink, MapPinned, Navigation, Route } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { TrustBadge } from "@/components/trust-badge";
import type { UniversityProfile } from "@/lib/types";

const CampusMapLeaflet = dynamic(() => import("@/components/university/campus-map-leaflet"), {
  ssr: false,
  loading: () => <div className="size-full animate-pulse bg-muted" />,
});

export function CampusMap({ profile }: { profile: UniversityProfile }) {
  const { t, locale } = useI18n();
  const m = t.profile.map;
  const { campus, cityCenter, distanceToCenterKm } = profile.location ?? {};

  if (!campus) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">
        <MapPinned className="size-5 shrink-0" />
        {m.noCampus}
      </div>
    );
  }

  const geotagged = profile.photos.filter((p) => p.coords);
  const cityLabel = cityCenter?.label ?? profile.city ?? "";
  const km = distanceToCenterKm !== undefined
    ? new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(distanceToCenterKm)
    : undefined;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
      {/* `isolate` keeps Leaflet's high z-indexes below the sticky site header. */}
      <div className="relative isolate h-[360px] overflow-hidden rounded-xl border border-border md:h-[460px]">
        <CampusMapLeaflet
          campus={campus}
          cityCenter={cityCenter}
          photos={geotagged}
          labels={{
            campus: `${m.campus}: ${profile.label}`,
            cityCenter: cityCenter ? m.cityCenter(cityLabel) : undefined,
            source: t.profile.source,
          }}
        />
      </div>

      <aside className="flex flex-col gap-3">
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Navigation className="size-4" />
            {m.distanceTitle}
          </p>
          {km ? (
            <>
              <p className="mt-2 text-4xl font-semibold tracking-tight">{m.km(km)}</p>
              <p className="mt-2 text-sm text-muted-foreground">{m.distanceHint(cityLabel)}</p>
              <TrustBadge
                className="mt-3"
                {...(campus.source === "wikidata"
                  ? { level: "high" as const, source: "Wikidata", hint: t.trust.hints.distanceWikidata }
                  : { level: "medium" as const, source: "Wikipedia", hint: t.trust.hints.distanceWikipedia })}
              />
            </>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">{m.noDistance}</p>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-5 text-sm">
          <ul className="grid gap-2">
            <li className="flex items-center gap-2">
              <span className="size-3.5 rounded-full border-2 border-white bg-neutral-900 shadow ring-1 ring-border" />
              {m.campus}
            </li>
            {cityCenter && (
              <li className="flex items-center gap-2">
                <span className="size-3.5 rounded-full border-2 border-white bg-blue-600 shadow ring-1 ring-border" />
                {m.cityCenter(cityLabel)}
              </li>
            )}
            <li className="flex items-center gap-2">
              <span className="flex gap-0.5">
                <span className="size-2.5 rounded-full bg-emerald-500" />
                <span className="size-2.5 rounded-full bg-amber-500" />
                <span className="size-2.5 rounded-full bg-zinc-500" />
              </span>
              {m.photoLocations}
            </li>
          </ul>
          <p className="mt-3 text-muted-foreground">{m.photosOnMap(geotagged.length)}</p>
          <p className="mt-1 text-muted-foreground">
            {m.coordsSource(campus.source === "wikidata" ? "Wikidata" : "Wikipedia")}
          </p>
          {cityCenter && (
            <a
              href={`https://www.openstreetmap.org/directions?route=${campus.lat}%2C${campus.lon}%3B${cityCenter.lat}%2C${cityCenter.lon}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 font-medium underline-offset-4 hover:underline"
            >
              <Route className="size-4" />
              {m.route}
              <ExternalLink className="size-3.5" />
            </a>
          )}
        </div>
      </aside>
    </div>
  );
}
