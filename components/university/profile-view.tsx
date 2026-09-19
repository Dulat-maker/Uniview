"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import {
  AlertTriangle,
  Check,
  ExternalLink,
  Globe,
  GraduationCap,
  Loader2,
  Scale,
  MapPin,
  SearchX,
} from "lucide-react";
import { SearchBox } from "@/components/search-box";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/i18n-provider";
import { CampusMap } from "@/components/university/campus-map";
import { Rich } from "@/components/rich-text";
import { WikipediaAbout } from "@/components/university/campus-summary";
import { MainGallery } from "@/components/university/main-gallery";
import { SourcesSection } from "@/components/university/sources-section";
import { FilterCards } from "@/components/university/filter-cards";
import { PhotoCard } from "@/components/university/photo-card";
import { SaveButton } from "@/components/save-button";
import { DormsSection } from "@/components/university/dorms-section";
import { InfraSection } from "@/components/university/infra-section";
import { OpenDays } from "@/components/university/open-days";
import { LatestPhotos } from "@/components/university/latest-photos";
import { LivingSection } from "@/components/university/living-section";
import { StudentSection } from "@/components/university/student-section";
import {
  TIME_LIMIT_MS,
  photoCategories,
  photoTags,
  seasons,
  type PhotoCategory,
  type PhotoTag,
  type Season,
  type TimeOfDay,
  type ProfileStage,
  type UniversityProfile,
} from "@/lib/types";
import { useProfile } from "@/lib/use-profile";
import { cn } from "@/lib/utils";

const STAGES: ProfileStage[] = ["search", "verification", "categories", "profile"];

export function UniversityProfileView({ qid }: { qid: string }) {
  const { state, seconds, retry } = useProfile(qid);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <SearchBox className="max-w-md" />
      <div className="mt-8">
        {state.kind === "loading" && <LoadingSteps stage={state.stage} seconds={seconds} />}
        {state.kind === "error" && <ErrorPanel code={state.code} onRetry={retry} />}
        {state.kind === "done" && <Profile profile={state.profile} />}
      </div>
    </div>
  );
}

function LoadingSteps({ stage, seconds }: { stage: ProfileStage | null; seconds: number }) {
  const { t } = useI18n();
  // Step 1 (name) is already done: the user picked the university.
  const activeIndex = stage ? STAGES.indexOf(stage) : 0;
  const steps = [
    { label: t.profile.steps.name, state: "done" as const },
    ...STAGES.map((s, i) => ({
      label: t.profile.steps[s],
      state: i < activeIndex ? ("done" as const) : i === activeIndex ? ("active" as const) : ("pending" as const),
    })),
  ];

  return (
    <div className="mx-auto max-w-2xl rounded-2xl border border-border bg-card p-6" aria-live="polite">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">{t.profile.loadingTitle}</h1>
        <span className="font-mono text-sm tabular-nums text-muted-foreground">
          {t.profile.elapsed(seconds, TIME_LIMIT_MS / 1000)}
        </span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-1000 ease-linear"
          style={{ width: `${Math.min(100, (seconds / (TIME_LIMIT_MS / 1000)) * 100)}%` }}
        />
      </div>
      <ol className="mt-6 grid gap-3 sm:grid-cols-5">
        {steps.map((step, i) => (
          <li key={step.label} className="flex items-center gap-2 sm:flex-col sm:text-center">
            <span
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-full border text-sm font-medium",
                step.state === "done" && "border-primary bg-primary text-primary-foreground",
                step.state === "active" && "border-primary text-foreground",
                step.state === "pending" && "border-border text-muted-foreground"
              )}
            >
              {step.state === "done" ? (
                <Check className="size-4" />
              ) : step.state === "active" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                i + 1
              )}
            </span>
            <span className={cn("text-sm", step.state === "pending" && "text-muted-foreground")}>{step.label}</span>
          </li>
        ))}
      </ol>
      <p className="mt-6 text-sm text-muted-foreground">{t.profile.stepHints[stage ?? "search"]}</p>
    </div>
  );
}

function ErrorPanel({ code, onRetry }: { code: "not_found" | "upstream" | "timeout"; onRetry: () => void }) {
  const { t } = useI18n();
  const title = code === "timeout" ? t.profile.timeout : code === "not_found" ? t.profile.notFound : t.profile.error;
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-6">
      <p className="flex items-center gap-2 font-medium">
        {code === "not_found" ? <SearchX className="size-5" /> : <AlertTriangle className="size-5 text-destructive" />}
        {title}
      </p>
      {code === "timeout" && <p className="text-sm text-muted-foreground">{t.profile.timeoutHint}</p>}
      {code !== "not_found" && (
        <Button variant="outline" onClick={onRetry}>
          {t.profile.retry}
        </Button>
      )}
    </div>
  );
}

function Profile({ profile }: { profile: UniversityProfile }) {
  const { t, locale } = useI18n();
  const [category, setCategory] = React.useState<PhotoCategory | "all">("all");
  const [tags, setTags] = React.useState<PhotoTag[]>([]);
  const [season, setSeason] = React.useState<Season | "any">("any");
  const [timeOfDay, setTimeOfDay] = React.useState<TimeOfDay | "any">("any");

  const tagCounts = Object.fromEntries(
    photoTags.map((tag) => [tag, profile.photos.filter((p) => p.tags.includes(tag)).length])
  ) as Record<PhotoTag, number>;

  const byTags = (tags.length ? profile.photos.filter((p) => p.tags.some((tag) => tags.includes(tag))) : profile.photos)
    .filter((p) => season === "any" || p.season === season)
    .filter((p) => timeOfDay === "any" || p.timeOfDay === timeOfDay);
  const visible = category === "all" ? byTags : byTags.filter((p) => p.category === category);

  const toggleTag = (tag: PhotoTag) =>
    setTags((prev) => (prev.includes(tag) ? prev.filter((x) => x !== tag) : [...prev, tag]));

  const { stats } = profile;

  return (
    <div className="flex flex-col gap-8">
      {/* Header: name, place, official link */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-white">
          {profile.logoUrl ? (
            <Image src={profile.logoUrl} alt="" width={64} height={64} unoptimized className="size-full object-contain p-1" />
          ) : (
            <GraduationCap className="size-7 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{profile.label}</h1>
          {profile.description && <p className="mt-1 text-muted-foreground">{profile.description}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {(profile.city || profile.country) && (
              <span className="flex items-center gap-1">
                <MapPin className="size-4" />
                {[profile.city, profile.country].filter(Boolean).join(", ")}
              </span>
            )}
            {profile.founded && (
              <span>
                <Rich text={t.profile.founded(profile.founded)} />
              </span>
            )}
            {profile.students && (
              <span>
                <Rich text={t.profile.students(new Intl.NumberFormat(locale).format(profile.students))} />
              </span>
            )}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <SaveButton
              info={{ qid: profile.qid, label: profile.label, city: profile.city, country: profile.country, website: profile.website }}
            />
            {profile.website ? (
              <a
                href={profile.website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/85"
              >
                <Globe className="size-4" />
                {t.profile.website}
                <ExternalLink className="size-3.5" />
              </a>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-1.5 text-sm text-muted-foreground">
                <Globe className="size-4" />
                {t.profile.noWebsite}
              </span>
            )}
            <Link
              href={`/compare?ids=${profile.qid}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted"
            >
              <Scale className="size-4" />
              {t.profile.compareWith}
            </Link>
          </div>
        </div>
      </header>

      <section aria-label={t.profile.photosTitle}>
        <MainGallery profile={profile} />
      </section>

      <div id="details" className="scroll-mt-20" />

      {/* Honest notices */}
      {(profile.partial || !profile.hasCoordinates) && (
        <div className="flex flex-col gap-2 rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 text-sm">
          {profile.partial && (
            <p className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
              {t.profile.partial}
            </p>
          )}
          {!profile.hasCoordinates && (
            <p className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
              {t.profile.noCoords}
            </p>
          )}
        </div>
      )}

      {profile.wikipedia?.extract && (
        <section>
          <h2 className="mb-3 text-2xl font-semibold tracking-tight">{t.profile.aboutTitle}</h2>
          <WikipediaAbout profile={profile} />
        </section>
      )}

      <section>
        <h2 className="mb-3 text-2xl font-semibold tracking-tight">{t.profile.map.title}</h2>
        <CampusMap profile={profile} />
      </section>

      <section>
        <h2 className="mb-3 text-2xl font-semibold tracking-tight">{t.profile.infra.title}</h2>
        <InfraSection profile={profile} />
      </section>

      <section>
        <h2 className="mb-3 text-2xl font-semibold tracking-tight">{t.profile.living.title}</h2>
        <LivingSection profile={profile} />
      </section>

      <section>
        <h2 className="mb-3 text-2xl font-semibold tracking-tight">{t.profile.dorms.title}</h2>
        <DormsSection profile={profile} />
      </section>

      <section>
        <h2 className="mb-3 text-2xl font-semibold tracking-tight">{t.profile.openDays.title}</h2>
        <OpenDays profile={profile} />
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">{t.profile.filtersTitle}</h2>
            <p className="text-sm text-muted-foreground">{t.profile.filtersHint}</p>
          </div>
          {tags.length > 0 && (
            <Button variant="ghost" onClick={() => setTags([])}>
              {t.profile.clearFilters}
            </Button>
          )}
        </div>
        <FilterCards counts={tagCounts} selected={tags} onToggle={toggleTag} />
      </section>

      <section id="photos" className="scroll-mt-20">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-2xl font-semibold tracking-tight">{t.profile.photosTitle}</h2>
          <p className="text-sm text-muted-foreground">{t.profile.showing(visible.length, profile.photos.length)}</p>
        </div>

        <SeasonFilter
          profile={profile}
          season={season}
          timeOfDay={timeOfDay}
          onSeason={setSeason}
          onTimeOfDay={setTimeOfDay}
        />

        <div role="tablist" className="mb-4 flex flex-wrap gap-1.5">
          {(["all", ...photoCategories] as const).map((c) => {
            const n = c === "all" ? byTags.length : byTags.filter((p) => p.category === c).length;
            return (
              <button
                key={c}
                type="button"
                role="tab"
                aria-selected={category === c}
                onClick={() => setCategory(c)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                  category === c ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                {t.categories[c]} <span className="opacity-70">{n}</span>
              </button>
            );
          })}
        </div>

        {visible.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-4 py-12 text-center">
            <SearchX className="size-8 text-muted-foreground" />
            <p className="font-medium">{t.profile.notEnoughData}</p>
            <p className="max-w-md text-sm text-muted-foreground">{t.profile.notEnoughDataHint}</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((photo, i) => (
              <PhotoCard key={photo.id} photo={photo} eager={i < 3} />
            ))}
          </div>
        )}

        <p className="mt-6 text-xs text-muted-foreground">
          {t.profile.removed(stats.duplicatesRemoved, stats.irrelevantRemoved, stats.lowEvidenceRemoved)}
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-2xl font-semibold tracking-tight">{t.profile.latest.title}</h2>
        <LatestPhotos profile={profile} />
      </section>

      <section>
        <h2 className="mb-3 text-2xl font-semibold tracking-tight">{t.profile.student.title}</h2>
        <StudentSection
          profile={profile}
          onShowAll={() => {
            setTags(["studentLife"]);
            setCategory("all");
            setSeason("any");
            setTimeOfDay("any");
            document.getElementById("photos")?.scrollIntoView({ behavior: "smooth" });
          }}
        />
      </section>

      <section>
        <h2 className="mb-3 text-2xl font-semibold tracking-tight">{t.profile.sources.title}</h2>
        <SourcesSection profile={profile} />
      </section>
    </div>
  );
}

function SeasonFilter({
  profile,
  season,
  timeOfDay,
  onSeason,
  onTimeOfDay,
}: {
  profile: UniversityProfile;
  season: Season | "any";
  timeOfDay: TimeOfDay | "any";
  onSeason: (s: Season | "any") => void;
  onTimeOfDay: (t: TimeOfDay | "any") => void;
}) {
  const { t } = useI18n();
  const s = t.profile.seasons;
  const chip = (active: boolean) =>
    cn(
      "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
      active ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:text-foreground"
    );
  const countSeason = (x: Season) => profile.photos.filter((p) => p.season === x).length;
  const countTime = (x: TimeOfDay) => profile.photos.filter((p) => p.timeOfDay === x).length;

  return (
    <div className="mb-4 flex flex-col gap-2 rounded-xl border border-border p-3">
      <p className="text-sm font-medium">{s.title}</p>
      <div className="flex flex-wrap gap-1.5">
        <button type="button" aria-pressed={season === "any"} className={chip(season === "any")} onClick={() => onSeason("any")}>
          {s.any}
        </button>
        {seasons.map((x) => (
          <button key={x} type="button" aria-pressed={season === x} className={chip(season === x)} onClick={() => onSeason(x)}>
            {s[x]} <span className="opacity-70">{countSeason(x)}</span>
          </button>
        ))}
        <span className="mx-1 w-px bg-border" />
        <button type="button" aria-pressed={timeOfDay === "any"} className={chip(timeOfDay === "any")} onClick={() => onTimeOfDay("any")}>
          {s.anyTime}
        </button>
        {(["day", "night"] as const).map((x) => (
          <button key={x} type="button" aria-pressed={timeOfDay === x} className={chip(timeOfDay === x)} onClick={() => onTimeOfDay(x)}>
            {s[x]} <span className="opacity-70">{countTime(x)}</span>
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {s.known(
          profile.photos.filter((p) => p.season).length,
          profile.photos.filter((p) => p.timeOfDay).length,
          profile.photos.length
        )}
      </p>
    </div>
  );
}
