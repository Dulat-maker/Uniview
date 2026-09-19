"use client";

import React from "react";
import { Loader2, Plane, TrainFront } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { Rich } from "@/components/rich-text";
import { TrustBadge } from "@/components/trust-badge";
import type { LatLon, TravelFacts, TravelPlace } from "@/lib/types";

export type TravelState = { kind: "loading" } | { kind: "error" } | { kind: "done"; travel: TravelFacts };

const requests = new Map<string, Promise<TravelFacts>>();
function loadTravel(at: LatLon) {
  const key = `${at.lat.toFixed(3)},${at.lon.toFixed(3)}`;
  let p = requests.get(key);
  if (!p) {
    p = fetch(`/api/travel?lat=${at.lat}&lon=${at.lon}`, { signal: AbortSignal.timeout(30_000) })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { travel: TravelFacts }) => {
        // Show what was found, but look again next time for the part that failed.
        if (!d.travel.complete) requests.delete(key);
        return d.travel;
      });
    p.catch(() => requests.delete(key));
    requests.set(key, p);
  }
  return p;
}

/** Nearest airport and railway stations, fetched after the profile is shown (the query is slow). */
export function useTravel(at: LatLon | undefined): TravelState | undefined {
  const key = at ? `${at.lat},${at.lon}` : "";
  const [state, setState] = React.useState<{ key: string; state: TravelState } | null>(null);
  React.useEffect(() => {
    if (!at) return;
    let alive = true;
    loadTravel(at)
      .then((travel) => alive && setState({ key, state: { kind: "done", travel } }))
      .catch(() => alive && setState({ key, state: { kind: "error" } }));
    return () => {
      alive = false;
    };
    // `key` captures the coordinates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  if (!at) return undefined;
  return state?.key === key ? state.state : { kind: "loading" };
}

/** Rough door-to-door time by car/taxi: road ≈ 1.3 × straight line; slower speeds inside cities. */
export function travelMinutes(km: number) {
  const road = km * 1.3;
  const speed = road <= 10 ? 25 : road <= 30 ? 35 : 60;
  const minutes = (road / speed) * 60;
  const round = (m: number) => Math.max(5, Math.round(m / 5) * 5);
  return { low: round(minutes * 0.8), high: round(minutes * 1.25) };
}

export function placeName(p: TravelPlace, locale: string) {
  return (locale === "ru" && p.nameRu) || p.name;
}

export function GettingHere({ coords }: { coords?: LatLon }) {
  const { t, locale } = useI18n();
  const g = t.profile.gettingHere;
  const state = useTravel(coords);
  const km = (v: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(v);

  const line = (p: TravelPlace, label: string) => {
    const time = travelMinutes(p.km);
    return <Rich text={g.line(label, km(p.km), `${time.low}–${time.high}`)} />;
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
      <h3 className="flex items-center gap-2 font-semibold">
        <Plane className="size-5 text-muted-foreground" />
        {g.title}
      </h3>
      <div className="flex-1 text-sm">
        {!state ? (
          <p className="text-muted-foreground">{g.noCoords}</p>
        ) : state.kind === "loading" ? (
          <p className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {g.loading}
          </p>
        ) : state.kind === "error" ? (
          <p className="text-muted-foreground">{g.failed}</p>
        ) : (
          <ul className="grid gap-2">
            <li className="flex gap-2">
              <Plane className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <span>
                {state.travel.airport
                  ? line(state.travel.airport, g.airport(placeName(state.travel.airport, locale), state.travel.airport.iata))
                  : state.travel.airport === null
                    ? g.noAirport
                    : g.airportFailed}
              </span>
            </li>
            {state.travel.stations?.length ? (
              state.travel.stations.map((s) => (
                <li key={s.qid} className="flex gap-2">
                  <TrainFront className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <span>{line(s, placeName(s, locale))}</span>
                </li>
              ))
            ) : (
              <li className="flex gap-2 text-muted-foreground">
                <TrainFront className="mt-0.5 size-4 shrink-0" />
                {state.travel.stations ? g.noStation : g.stationFailed}
              </li>
            )}
          </ul>
        )}
        {state?.kind === "done" && <p className="mt-3 text-xs text-muted-foreground">{g.method}</p>}
      </div>
      {state?.kind === "done" && <TrustBadge level="medium" source="Wikidata" hint={t.trust.hints.travel} />}
    </div>
  );
}
