"use client";

import type { ReactNode } from "react";
import { Bus, CloudSun } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { Rich } from "@/components/rich-text";
import { TrustBadge } from "@/components/trust-badge";
import { CostOfLiving } from "@/components/university/cost-of-living";
import { GettingHere } from "@/components/university/getting-here";
import type { CityFacts, UniversityProfile } from "@/lib/types";

export function monthName(index: number, locale: string) {
  return new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2024, index, 15)));
}

export function formatTemp(t: number, locale: string) {
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0, signDisplay: "exceptZero" }).format(t)} °C`;
}

/** Coldest / warmest month and yearly precipitation, shared with the compare page. */
export function climateSummary(climate: NonNullable<CityFacts["climate"]>) {
  const valid = climate.months.map((m, i) => ({ ...m, i })).filter((m) => Number.isFinite(m.t));
  if (!valid.length) return undefined;
  const coldest = valid.reduce((a, b) => (b.t < a.t ? b : a));
  const warmest = valid.reduce((a, b) => (b.t > a.t ? b : a));
  const yearly = climate.months.reduce((sum, m) => sum + m.p, 0);
  return { coldest, warmest, yearly };
}

function Card({
  icon: Icon,
  title,
  badge,
  children,
}: {
  icon: typeof Bus;
  title: string;
  badge?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
      <h3 className="flex items-center gap-2 font-semibold">
        <Icon className="size-5 text-muted-foreground" />
        {title}
      </h3>
      <div className="flex-1 text-sm">{children}</div>
      {badge}
    </div>
  );
}

export function LivingSection({ profile }: { profile: UniversityProfile }) {
  const { t, locale } = useI18n();
  const facts = profile.facts;
  const l = t.profile.living;
  const num = (n: number) => new Intl.NumberFormat(locale).format(n);

  const climate = facts.climate;
  const summary = climate ? climateSummary(climate) : undefined;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card
        icon={CloudSun}
        title={l.climateTitle}
        badge={climate && <TrustBadge level="high" source="Open-Meteo (ERA5)" hint={t.trust.hints.climate} />}
      >
        {climate && summary ? (
          <>
            <p className="text-muted-foreground">{l.climateHint(climate.years)}</p>
            <ul className="mt-2 grid gap-0.5">
              <li>
                <Rich text={l.coldest(monthName(summary.coldest.i, locale), formatTemp(summary.coldest.t, locale))} />
              </li>
              <li>
                <Rich text={l.warmest(monthName(summary.warmest.i, locale), formatTemp(summary.warmest.t, locale))} />
              </li>
              <li>
                <Rich text={l.precipitation(num(summary.yearly))} />
              </li>
            </ul>
            {/* Plain month-by-month table (no chart): average temperature and precipitation. */}
            <div className="mt-3 grid grid-cols-6 gap-1 text-center text-[11px] tabular-nums">
              {climate.months.map((m, i) => (
                <div key={i} className="rounded-md bg-muted px-1 py-1.5">
                  <div className="text-muted-foreground">{monthName(i, locale)}</div>
                  <div className="font-medium">{Number.isFinite(m.t) ? formatTemp(m.t, locale).replace(" °C", "°") : "—"}</div>
                  <div className="text-muted-foreground">{m.p} {l.mm}</div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-muted-foreground">{l.noClimate}</p>
        )}
      </Card>

      <Card
        icon={Bus}
        title={l.transportTitle}
        badge={facts.transport && <TrustBadge level="medium" source="OpenStreetMap" hint={t.trust.hints.transport} />}
      >
        {facts.transport ? (
          <ul className="grid gap-1.5">
            <li className="text-base font-medium">
              {facts.transport.stops1km > 0 ? <Rich text={l.stops(facts.transport.stops1km)} /> : l.noStops}
            </li>
            {facts.transport.nearestStop && (
              <li>
                <Rich text={l.nearestStop(facts.transport.nearestStop.name ?? l.unnamedStop, num(facts.transport.nearestStop.distanceM))} />
              </li>
            )}
            {facts.transport.stations.map((s, i) => (
              <li key={i} className="text-muted-foreground">
                {l.stationKinds[s.kind]}
                {s.name ? ` «${s.name}»` : ""} · {l.meters(num(s.distanceM))}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground">{l.noTransport}</p>
        )}
      </Card>

      <GettingHere coords={profile.location.campus} />
      <div className="lg:col-span-3">
        <CostOfLiving profile={profile} />
      </div>
    </div>
  );
}
