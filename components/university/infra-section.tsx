"use client";

import { Bot, Building2, Gauge, MinusCircle } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { Rich } from "@/components/rich-text";
import { TrustBadge } from "@/components/trust-badge";
import { comfortIndex, type ComfortFactorKey } from "@/lib/comfort";
import type { UniversityProfile } from "@/lib/types";

/** Meter: one hue — accent fill on a lighter step of the same ramp; value always in text. */
function Meter({ value, max, label }: { value: number; max: number; label: string }) {
  return (
    <div
      role="meter"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-label={label}
      title={label}
      className="h-2 w-full overflow-hidden rounded-full bg-blue-100 dark:bg-blue-950"
    >
      <div className="h-full rounded-full bg-blue-600 dark:bg-blue-400" style={{ width: `${(value / max) * 100}%` }} />
    </div>
  );
}

export function InfraSection({ profile }: { profile: UniversityProfile }) {
  const { t, locale } = useI18n();
  const x = t.profile.infra;
  const num = (n: number) => new Intl.NumberFormat(locale).format(n);
  const comfort = comfortIndex(profile.facts);
  const { transport, amenities } = profile.facts;

  const details: Record<ComfortFactorKey, string> | undefined =
    transport && amenities
      ? {
          transport: x.detail.transport(transport.stops1km, transport.stations.length),
          food: x.detail.food(amenities.food, amenities.shops),
          green: x.detail.green(amenities.parks, amenities.nearestParkM !== undefined ? num(amenities.nearestParkM) : undefined),
          health: x.detail.health(amenities.pharmacies, amenities.sport),
        }
      : undefined;

  // Photo evidence: measured greenery (non-winter campus photos) and how recent the object photos are.
  const campusMeasured = profile.photos.filter(
    (p) => p.category === "campus" && p.greenShare !== undefined && p.season !== "winter"
  );
  const greenPct = campusMeasured.length
    ? Math.round((campusMeasured.reduce((s, p) => s + (p.greenShare ?? 0), 0) / campusMeasured.length) * 100)
    : undefined;
  const objects = [
    { label: t.filters.labs, photos: profile.photos.filter((p) => p.tags.includes("labs")) },
    { label: t.categories.dormitory, photos: profile.photos.filter((p) => p.category === "dormitory" || p.tags.includes("dormitory")) },
    { label: t.categories.library, photos: profile.photos.filter((p) => p.category === "library") },
    { label: t.filters.athletics, photos: profile.photos.filter((p) => p.tags.includes("athletics")) },
  ];
  const newestYear = (photos: UniversityProfile["photos"]) => {
    const years = photos.map((p) => p.date?.slice(0, 4)).filter((y): y is string => !!y);
    return years.length ? years.sort().at(-1) : undefined;
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
        <h3 className="flex items-center gap-2 font-semibold">
          <Gauge className="size-5 text-muted-foreground" />
          {x.comfortTitle}
        </h3>
        {comfort && details ? (
          <>
            <p className="flex items-baseline gap-2">
              <span className="text-5xl font-semibold tracking-tight">{comfort.score}</span>
              <span className="text-sm text-muted-foreground">{x.outOf}</span>
            </p>
            <ul className="grid gap-3 text-sm">
              {comfort.factors.map((f) => (
                <li key={f.key} className="grid gap-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-medium">{x.factors[f.key]}</span>
                    <span className="tabular-nums text-muted-foreground">{x.points(f.points, f.max)}</span>
                  </div>
                  <Meter value={f.points} max={f.max} label={`${x.factors[f.key]}: ${x.points(f.points, f.max)}`} />
                  <span className="text-xs text-muted-foreground">
                    <Rich text={details[f.key]} />
                  </span>
                </li>
              ))}
              {[x.rent, x.safety].map((label) => (
                <li key={label} className="flex items-center justify-between gap-3 border-t border-dashed border-border pt-2">
                  <span className="font-medium">{label}</span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MinusCircle className="size-3.5" />
                    {x.noOpenData}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">{x.basis}</p>
            <TrustBadge level="medium" source="OpenStreetMap" hint={t.trust.hints.comfort} />
          </>
        ) : (
          <p className="text-sm text-muted-foreground">{x.noComfort}</p>
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 text-sm">
        <h3 className="flex items-center gap-2 font-semibold">
          <Building2 className="size-5 text-muted-foreground" />
          {x.photoTitle}
        </h3>
        <p>{greenPct !== undefined ? <Rich text={x.greenery(greenPct, campusMeasured.length)} /> : x.noGreenery}</p>
        {greenPct !== undefined && (
          <TrustBadge className="self-start" level="low" source="Wikimedia Commons" hint={t.trust.hints.greenery} />
        )}
        <ul className="grid gap-1">
          {objects.map((o) => (
            <li key={o.label}>
              {o.photos.length ? <Rich text={x.objectPhotos(o.label, o.photos.length, newestYear(o.photos))} /> : x.noObjectPhotos(o.label)}
            </li>
          ))}
        </ul>
        <p className="mt-auto flex items-start gap-2 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
          <Bot className="mt-0.5 size-4 shrink-0" />
          {x.aiNote}
        </p>
      </div>
    </div>
  );
}
