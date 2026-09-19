"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, Copy, ExternalLink, GraduationCap, Loader2, MapPin, Plus, Printer, Trophy, X } from "lucide-react";
import { UniversityPicker } from "@/components/compare/university-picker";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/i18n-provider";
import { TrustBadge } from "@/components/trust-badge";
import { factText } from "@/components/shared-view";
import { SaveButton } from "@/components/save-button";
import { travelMinutes, useTravel, type TravelState } from "@/components/university/getting-here";
import { climateSummary, formatTemp, monthName } from "@/components/university/living-section";
import { comfortIndex } from "@/lib/comfort";
import { formatMoney, studentBudget } from "@/lib/cost";
import { usePersonal, type MyFactKey, type PersonalData } from "@/lib/personal-store";
import { TIME_LIMIT_MS, type Photo, type UniversityProfile } from "@/lib/types";
import { useProfile, type ProfileViewState } from "@/lib/use-profile";
import { cn } from "@/lib/utils";

export const MAX_COMPARE = 4;
const compareHref = (ids: string[]) => (ids.length ? `/compare?ids=${ids.join(",")}` : "/compare");

export function CompareView({ ids }: { ids: string[] }) {
  const { t } = useI18n();
  const router = useRouter();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{t.compare.title}</h1>
      <p className="mt-1 text-muted-foreground">{t.compare.subtitle}</p>

      <div className="mt-8">
        {ids.length === 0 ? (
          <UniversityPicker title={t.compare.pickFirst} onPick={(qid) => router.push(compareHref([qid]))} />
        ) : ids.length === 1 ? (
          <div className="grid gap-4 md:grid-cols-2">
            <SingleColumn qid={ids[0]} />
            <UniversityPicker title={t.compare.pickSecond} exclude={ids} onPick={(qid) => router.push(compareHref([ids[0], qid]))} />
          </div>
        ) : (
          <CompareTable ids={ids} />
        )}
      </div>
    </div>
  );
}

function SingleColumn({ qid }: { qid: string }) {
  const { state, seconds, retry } = useProfile(qid);
  return <ColumnHeader state={state} seconds={seconds} retry={retry} removeHref="/compare" />;
}

/** The most trusted photo of the campus itself (not an event with people, not the city). */
function coverOf(p: UniversityProfile) {
  const campus = p.photos
    .filter((x) => x.category === "campus" && !x.tags.includes("studentLife"))
    .sort((a, b) => b.confidence - a.confidence);
  return campus[0] ?? p.photos.find((x) => x.status === "verified" && x.category !== "city") ?? p.photos[0];
}

function ColumnHeader({
  state,
  seconds,
  retry,
  removeHref,
  compact = false,
}: {
  state: ProfileViewState;
  seconds: number;
  retry: () => void;
  removeHref: string;
  compact?: boolean;
}) {
  const { t } = useI18n();

  if (state.kind === "loading") {
    return (
      <div className="flex h-full min-h-24 flex-col items-center justify-center gap-1 rounded-xl border border-border p-3 text-center text-xs text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
        {t.compare.loading(seconds)}
        {!compact && <span>{t.profile.elapsed(seconds, TIME_LIMIT_MS / 1000)}</span>}
      </div>
    );
  }
  if (state.kind === "error") {
    return (
      <div className="flex h-full min-h-24 flex-col items-start justify-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs">
        <p className="flex items-center gap-1.5">
          <AlertTriangle className="size-4 shrink-0 text-destructive" />
          {state.code === "timeout" ? t.profile.timeout : t.compare.failed}
        </p>
        <Button variant="outline" size="sm" onClick={retry}>
          {t.profile.retry}
        </Button>
      </div>
    );
  }

  const p = state.profile;
  const cover = coverOf(p);
  return (
    <div className="relative flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card">
      <Link
        href={removeHref}
        aria-label={`${t.compare.remove}: ${p.label}`}
        title={t.compare.remove}
        className="absolute right-1.5 top-1.5 z-10 flex size-7 items-center justify-center rounded-full bg-background/90 text-muted-foreground shadow-sm hover:text-foreground print:hidden"
      >
        <X className="size-4" />
      </Link>
      {/* On phones the sticky header shows names only, so it doesn't cover half the screen. */}
      <div className={cn("relative bg-muted", compact ? "hidden aspect-[5/2] sm:block" : "aspect-[16/9]")}>
        {cover ? (
          <Image src={cover.thumbUrl} alt={cover.title} fill unoptimized sizes="25vw" className="object-cover" />
        ) : (
          <GraduationCap className="absolute inset-0 m-auto size-8 text-muted-foreground" />
        )}
      </div>
      <div className={cn("flex flex-1 flex-col gap-1 p-2.5", compact && "pr-8 sm:pr-2.5")}>
        <Link href={`/university/${p.qid}`} className="line-clamp-2 text-sm font-semibold leading-tight underline-offset-4 hover:underline md:text-base">
          {p.label}
        </Link>
        {(p.city || p.country) && (
          <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
            <MapPin className="size-3 shrink-0" />
            <span className="truncate">{[p.city, p.country].filter(Boolean).join(", ")}</span>
          </p>
        )}
      </div>
    </div>
  );
}

/** One comparable value. `num` enables "best value" highlighting; `text` drives "only differences". */
type Cell = { node: React.ReactNode; text: string; num?: number };
type Row = {
  key: string;
  label: string;
  get: (p: UniversityProfile, ctx: RowContext) => Cell | undefined;
  better?: "higher" | "lower";
  /** Values the user typed in on the Saved page (no open source). */
  mine?: boolean;
};
type Section = { key: string; title: string; rows: Row[]; badge?: React.ReactNode; note?: React.ReactNode };
type RowContext = { travel: TravelState | undefined; personal: PersonalData };

const cell = (node: React.ReactNode, text?: string, num?: number): Cell => ({ node, text: text ?? String(node), num });

function PhotoStrip({ photos }: { photos: Photo[] }) {
  return (
    <div className="flex snap-x gap-1.5 overflow-x-auto pb-1">
      {photos.slice(0, 8).map((ph) => (
        <a
          key={ph.id}
          href={ph.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          title={ph.title}
          className="relative block size-16 shrink-0 snap-start overflow-hidden rounded-md bg-muted sm:size-20"
        >
          <Image src={ph.thumbUrl} alt={ph.title} fill unoptimized sizes="80px" className="object-cover" />
        </a>
      ))}
    </div>
  );
}

/** "2 000 000 ₸" → 2000000; undefined when the user typed no number. */
const parseNumber = (v: string) => {
  const digits = v.replace(/[\s ]/g, "").match(/\d+(?:[.,]\d+)?/)?.[0];
  return digits ? Number(digits.replace(",", ".")) : undefined;
};

function CompareTable({ ids }: { ids: string[] }) {
  const { t, locale } = useI18n();
  const c = t.compare;
  const r = c.rows;
  const data = usePersonal();
  // Hooks can't run in a loop, so all four slots are always called; empty slots stay idle.
  const slots = [useProfile(ids[0]), useProfile(ids[1]), useProfile(ids[2]), useProfile(ids[3])].slice(0, ids.length);
  const profiles = slots.map((s) => (s.state.kind === "done" ? s.state.profile : undefined));
  const travel = [
    useTravel(profiles[0]?.location.campus),
    useTravel(profiles[1]?.location.campus),
    useTravel(profiles[2]?.location.campus),
    useTravel(profiles[3]?.location.campus),
  ];
  const [onlyDiff, setOnlyDiff] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const router = useRouter();

  const num = (n: number) => new Intl.NumberFormat(locale).format(n);
  const km = (n: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(n);
  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

  const photoRow = (key: string, label: string, pick: (x: Photo) => boolean): Row => ({
    key,
    label,
    better: "higher",
    get: (p) => {
      const list = p.photos.filter(pick).sort((a, b) => b.confidence - a.confidence);
      return {
        num: list.length,
        text: String(list.length),
        node: list.length ? (
          <div className="flex flex-col gap-1">
            <span>{t.profile.photoCount(list.length)}</span>
            <PhotoStrip photos={list} />
          </div>
        ) : (
          <span className="text-muted-foreground">{c.noPhotos}</span>
        ),
      };
    },
  });

  const mineRow = (key: MyFactKey, better?: "higher" | "lower"): Row => ({
    key,
    label: t.saved.myFacts[key],
    mine: true,
    better,
    get: (p, ctx) => {
      const v = ctx.personal.saved[p.qid]?.myFacts?.[key];
      if (!v) return undefined;
      return cell(factText(key, v, t.saved), v, better ? parseNumber(v) : undefined);
    },
  });

  const travelRow = (key: "airport" | "railway"): Row => ({
    key,
    label: r[key],
    better: "lower",
    get: (_p, ctx) => {
      if (!ctx.travel || ctx.travel.kind !== "done") {
        return ctx.travel?.kind === "loading" ? { node: <Loader2 className="size-4 animate-spin text-muted-foreground" />, text: "…" } : undefined;
      }
      const place = key === "airport" ? ctx.travel.travel.airport : ctx.travel.travel.stations?.[0];
      if (!place) return undefined;
      const time = travelMinutes(place.km);
      const name = (locale === "ru" && place.nameRu) || place.name;
      return {
        num: place.km,
        text: `${place.qid}|${place.km}`,
        node: (
          <span>
            ≈ {time.low}–{time.high} {locale === "ru" ? "мин" : "min"}
            <span className="block text-xs font-normal text-muted-foreground">
              {name}
              {place.iata ? ` (${place.iata})` : ""}, {t.profile.map.km(km(place.km))}
            </span>
          </span>
        ),
      };
    },
  });

  const sections: Section[] = [
    {
      key: "overview",
      title: c.sections.overview,
      rows: [
        { key: "founded", label: r.founded, get: (p) => (p.founded ? cell(p.founded) : undefined) },
        { key: "students", label: r.students, better: "higher", get: (p) => (p.students ? cell(num(p.students), undefined, p.students) : undefined) },
        {
          key: "website",
          label: r.website,
          get: (p) =>
            p.website
              ? {
                  text: p.website,
                  node: (
                    <a href={p.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 break-all underline-offset-4 hover:underline">
                      {new URL(p.website).hostname.replace(/^www\./, "")}
                      <ExternalLink className="size-3 shrink-0" />
                    </a>
                  ),
                }
              : undefined,
        },
        {
          key: "verified",
          label: r.verified,
          better: "higher",
          get: (p) => {
            const v = p.photos.filter((x) => x.status === "verified").length;
            return p.photos.length ? cell(`${num(v)} / ${num(p.photos.length)} (${pct(v, p.photos.length)}%)`, undefined, v / p.photos.length) : undefined;
          },
        },
        {
          key: "distance",
          label: r.distance,
          better: "lower",
          get: (p) =>
            p.location.distanceToCenterKm !== undefined
              ? cell(t.profile.map.km(km(p.location.distanceToCenterKm)), undefined, p.location.distanceToCenterKm)
              : undefined,
        },
      ],
    },
    {
      key: "infra",
      title: c.sections.infra,
      rows: [
        photoRow("dormPhotos", r.dormPhotos, (x) => x.category === "dormitory" || x.tags.includes("dormitory")),
        photoRow("sportPhotos", r.sportPhotos, (x) => x.tags.includes("athletics")),
        photoRow("labPhotos", r.labPhotos, (x) => x.tags.includes("labs")),
        photoRow("libraryPhotos", r.libraryPhotos, (x) => x.category === "library"),
        {
          key: "comfort",
          label: r.comfort,
          better: "higher",
          get: (p) => {
            const ci = comfortIndex(p.facts);
            return ci ? cell(`${ci.score} / 100`, undefined, ci.score) : undefined;
          },
        },
      ],
    },
    {
      key: "living",
      title: c.sections.living,
      badge: <TrustBadge level="medium" source="OpenStreetMap" hint={t.trust.hints.transport} />,
      rows: [
        mineRow("dormGuarantee"),
        mineRow("dormCost", "lower"),
        mineRow("dormType"),
        {
          key: "dormsNearby",
          label: r.dormsNearby,
          better: "higher",
          get: (p) => {
            const d = p.facts.dorms;
            if (!d) return undefined;
            const n = d.list.length + d.unnamed;
            return cell(num(n), undefined, n);
          },
        },
        {
          key: "nearestDorm",
          label: r.nearestDorm,
          better: "lower",
          get: (p) => {
            const d = p.facts.dorms?.list[0];
            if (!d) return undefined;
            const name = (locale === "ru" ? d.nameRu : d.nameEn) ?? d.name;
            return {
              num: d.distanceM,
              text: `${d.name}|${d.distanceM}`,
              node: (
                <span>
                  {t.profile.living.meters(num(d.distanceM))}
                  <span className="block text-xs font-normal text-muted-foreground">{name}</span>
                </span>
              ),
            };
          },
        },
      ],
    },
    {
      key: "study",
      title: c.sections.study,
      rows: [mineRow("passingScore"), mineRow("budgetPlaces", "higher"), mineRow("tuition", "lower"), mineRow("military")],
    },
    {
      key: "city",
      title: c.sections.city,
      badge: (
        <span className="flex flex-wrap gap-1">
          <TrustBadge level="low" source="World Bank" hint={t.trust.hints.cost} />
          <TrustBadge level="medium" source="Wikidata · OSM" hint={t.trust.hints.travel} />
          <TrustBadge level="high" source="Open-Meteo" hint={t.trust.hints.climate} />
        </span>
      ),
      rows: [
        {
          key: "budget",
          label: r.budget,
          better: "lower",
          get: (p) => {
            if (!p.facts.priceLevel) return undefined;
            const b = studentBudget(p.facts.priceLevel);
            return {
              num: b.total,
              text: String(Math.round(b.total)),
              node: (
                <span>
                  ≈ {formatMoney(b.total, "USD", locale)}
                  {b.local && (
                    <span className="block text-xs font-normal text-muted-foreground">
                      ≈ {formatMoney(b.total * b.local.rate, b.local.currency, locale)}
                    </span>
                  )}
                </span>
              ),
            };
          },
        },
        {
          key: "price",
          label: r.price,
          better: "lower",
          get: (p) => (p.facts.priceLevel ? cell(`${num(Math.round(p.facts.priceLevel.ratio * 100))}%`, undefined, p.facts.priceLevel.ratio) : undefined),
        },
        travelRow("airport"),
        travelRow("railway"),
        {
          key: "stops",
          label: r.stops,
          better: "higher",
          get: (p) => (p.facts.transport ? cell(num(p.facts.transport.stops1km), undefined, p.facts.transport.stops1km) : undefined),
        },
        {
          key: "station",
          label: r.station,
          better: "lower",
          get: (p) => {
            const s = p.facts.transport?.stations[0];
            return s
              ? cell(`${t.profile.living.stationKinds[s.kind]}${s.name ? ` «${s.name}»` : ""}, ${t.profile.living.meters(num(s.distanceM))}`, undefined, s.distanceM)
              : undefined;
          },
        },
        {
          key: "coldest",
          label: r.coldest,
          get: (p) => {
            const s = p.facts.climate && climateSummary(p.facts.climate);
            return s ? cell(`${monthName(s.coldest.i, locale)}, ${formatTemp(s.coldest.t, locale)}`) : undefined;
          },
        },
        {
          key: "warmest",
          label: r.warmest,
          get: (p) => {
            const s = p.facts.climate && climateSummary(p.facts.climate);
            return s ? cell(`${monthName(s.warmest.i, locale)}, ${formatTemp(s.warmest.t, locale)}`) : undefined;
          },
        },
        {
          key: "precipitation",
          label: r.precipitation,
          get: (p) => {
            const s = p.facts.climate && climateSummary(p.facts.climate);
            return s ? cell(`${num(s.yearly)} ${t.profile.living.mm}`) : undefined;
          },
        },
      ],
    },
  ];

  const allLoaded = profiles.every(Boolean);
  // Phones: the row label goes on its own line above the values; wider screens: a label column.
  const columns = "grid-cols-(--cols-sm) md:grid-cols-(--cols-md)";
  const gridVars = {
    "--cols-sm": `repeat(${ids.length}, minmax(0, 1fr))`,
    "--cols-md": `minmax(9rem, 0.8fr) repeat(${ids.length}, minmax(0, 1fr))`,
  } as React.CSSProperties;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: the address bar still has the link.
    }
  };

  return (
    <div className="flex flex-col gap-5" style={gridVars}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div role="radiogroup" aria-label={c.modeAll} className="inline-flex rounded-lg border border-border p-0.5 text-sm">
          {[false, true].map((diff) => (
            <button
              key={String(diff)}
              type="button"
              role="radio"
              aria-checked={onlyDiff === diff}
              onClick={() => setOnlyDiff(diff)}
              className={cn(
                "rounded-md px-3 py-1.5 font-medium transition-colors",
                onlyDiff === diff ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {diff ? c.modeDiff : c.modeAll}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={copyLink} title={c.shareHint}>
            {copied ? <Check /> : <Copy />}
            {copied ? c.linkCopied : c.copyLink}
          </Button>
          <Button variant="outline" onClick={() => window.print()}>
            <Printer />
            {c.print}
          </Button>
        </div>
      </div>

      {/* Column headers stay on screen while scrolling through the rows. */}
      <div className={cn("sticky top-14 z-30 -mx-4 grid gap-2 border-b border-border bg-background/95 px-4 py-2 backdrop-blur print:static", columns)}>
        <div className="hidden md:block" />
        {slots.map((s, i) => (
          <div key={ids[i]} className="flex min-w-0 flex-col gap-1.5">
            <ColumnHeader {...s} compact removeHref={compareHref(ids.filter((_, j) => j !== i))} />
            {profiles[i] && (
              <div className="hidden sm:block print:hidden">
                <SaveButton
                  compact
                  info={{ qid: profiles[i]!.qid, label: profiles[i]!.label, city: profiles[i]!.city, country: profiles[i]!.country, website: profiles[i]!.website }}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {sections.map((section) => {
        const rows = section.rows
          .map((row) => {
            const ctxs = ids.map((_, i) => ({ travel: travel[i], personal: data }));
            const cells = profiles.map((p, i) => (p ? row.get(p, ctxs[i]) : undefined));
            // Best value: only when at least two columns have numbers and they differ.
            const nums = cells.map((x) => x?.num).filter((n): n is number => n !== undefined);
            const best =
              row.better && nums.length >= 2 && new Set(nums).size > 1
                ? row.better === "higher"
                  ? Math.max(...nums)
                  : Math.min(...nums)
                : undefined;
            const texts = cells.map((x) => x?.text ?? "");
            const same = allLoaded && texts.every((x) => x === texts[0]);
            return { row, cells, best, same };
          })
          .filter((x) => !onlyDiff || !x.same);
        const hasMine = section.rows.some((row) => row.mine);

        return (
          <section key={section.key} className="overflow-hidden rounded-2xl border border-border break-inside-avoid">
            <div className="flex flex-wrap items-center justify-between gap-2 bg-muted/60 px-4 py-2.5">
              <h3 className="font-semibold">{section.title}</h3>
              {section.badge}
            </div>
            {hasMine && (
              <p className="flex flex-wrap items-center gap-x-2 border-b border-border bg-amber-500/5 px-4 py-2 text-xs text-muted-foreground">
                <span>
                  <span className="mr-1 rounded bg-amber-500/15 px-1.5 py-0.5 font-medium text-amber-800 dark:text-amber-300">{c.mine}</span>
                  {c.mineHint}
                </span>
                <Link href="/saved" className="font-medium text-foreground underline-offset-4 hover:underline print:hidden">
                  {c.mineEdit}
                </Link>
              </p>
            )}
            {rows.length === 0 ? (
              <p className="px-4 py-3 text-sm text-muted-foreground">{c.noDifferences}</p>
            ) : (
              <dl className="divide-y divide-border text-sm">
                {rows.map(({ row, cells, best }) => (
                  <div key={row.key} className={cn("grid gap-x-3 gap-y-1 px-4 py-2.5", columns)}>
                    <dt className="col-span-full text-muted-foreground md:col-span-1">
                      {row.label}
                      {row.mine && <span className="ml-1 text-xs text-amber-700 dark:text-amber-400">· {c.mine}</span>}
                    </dt>
                    {cells.map((x, i) => {
                      const isBest = best !== undefined && x?.num === best;
                      return (
                        <dd
                          key={ids[i]}
                          className={cn(
                            "min-w-0 break-words rounded-md font-medium",
                            isBest && "-mx-1.5 -my-1 bg-emerald-600/10 px-1.5 py-1 text-emerald-900 dark:text-emerald-200"
                          )}
                        >
                          {!profiles[i] ? (
                            <span className="text-muted-foreground">…</span>
                          ) : x ? (
                            <>
                              {x.node}
                              {isBest && (
                                <span className="mt-0.5 flex items-center gap-1 text-xs font-normal text-emerald-700 dark:text-emerald-300">
                                  <Trophy className="size-3" />
                                  {c.best}
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="font-normal text-muted-foreground">{row.mine ? c.mineMissing : c.noData}</span>
                          )}
                        </dd>
                      );
                    })}
                  </div>
                ))}
              </dl>
            )}
          </section>
        );
      })}

      {ids.length < MAX_COMPARE ? (
        <details className="rounded-2xl border border-dashed border-border print:hidden">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 font-medium">
            <Plus className="size-4" />
            {c.addAnother}
          </summary>
          <div className="border-t border-border p-4">
            <UniversityPicker title={c.addAnother} exclude={ids} onPick={(qid) => !ids.includes(qid) && router.push(compareHref([...ids, qid]))} />
          </div>
        </details>
      ) : (
        <p className="text-sm text-muted-foreground print:hidden">{c.maxReached}</p>
      )}
    </div>
  );
}
