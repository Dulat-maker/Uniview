"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, Check, ChevronDown, Copy, Download, Heart, MapPin, Printer, Scale, Share2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/i18n-provider";
import { reminderDetails, useReminderDownload } from "@/components/university/open-days";
import {
  APPLICATION_STEPS,
  MY_FACT_KEYS,
  PRIORITIES,
  calendarIcs,
  downloadFile,
  personal,
  usePersonal,
  type MyFactKey,
  type Reminder,
  type SavedUniversity,
} from "@/lib/personal-store";
import { shareUrl } from "@/lib/share";
import { cn } from "@/lib/utils";

type SortKey = "priority" | "status" | "recent";
const MAX_COMPARE = 4;

const priorityRank = (u: SavedUniversity) => (u.priority ? PRIORITIES.indexOf(u.priority) : PRIORITIES.length);
const stepRank = (u: SavedUniversity) => APPLICATION_STEPS.indexOf(u.step ?? "saved");

export const priorityStyles = {
  first: "border-emerald-600/40 bg-emerald-600/10 text-emerald-800 dark:text-emerald-300",
  backup: "border-sky-600/40 bg-sky-600/10 text-sky-800 dark:text-sky-300",
  dream: "border-violet-600/40 bg-violet-600/10 text-violet-800 dark:text-violet-300",
} as const;

/** Days from today (local time) to a YYYY-MM-DD date. */
export function daysUntil(date: string) {
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((Date.parse(`${date}T00:00:00Z`) - today) / 86_400_000);
}

export function SavedView() {
  const { t } = useI18n();
  const s = t.saved;
  const data = usePersonal();
  const router = useRouter();
  const [selected, setSelected] = React.useState<string[]>([]);
  const [priorityFilter, setPriorityFilter] = React.useState<string>("all");
  const [tagFilter, setTagFilter] = React.useState<string>("");
  const [sort, setSort] = React.useState<SortKey>("priority");

  const all = Object.values(data.saved);
  const allTags = [...new Set(all.flatMap((u) => u.tags ?? []))].sort();
  const shown = all
    .filter((u) => priorityFilter === "all" || (u.priority ?? "none") === priorityFilter)
    .filter((u) => !tagFilter || u.tags?.includes(tagFilter))
    .sort((a, b) =>
      sort === "priority"
        ? priorityRank(a) - priorityRank(b) || b.savedAt.localeCompare(a.savedAt)
        : sort === "status"
          ? stepRank(b) - stepRank(a) || priorityRank(a) - priorityRank(b)
          : b.savedAt.localeCompare(a.savedAt)
    );

  const toggle = (qid: string) =>
    setSelected((prev) => (prev.includes(qid) ? prev.filter((x) => x !== qid) : [...prev, qid].slice(-MAX_COMPARE)));
  const selectedExisting = selected.filter((q) => data.saved[q]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="flex items-center gap-2 text-3xl font-semibold tracking-tight md:text-4xl">
        <Heart className="size-7" />
        {s.title}
      </h1>
      <p className="mt-1 text-muted-foreground">{s.subtitle}</p>
      <p className="mt-1 text-xs text-muted-foreground">{s.storedLocally}</p>

      {all.length === 0 ? (
        <p className="mt-8 rounded-xl border border-dashed border-border p-6 text-muted-foreground">{s.empty}</p>
      ) : (
        <>
          <div className="mt-6 flex flex-wrap items-center gap-2 print:hidden">
            <ShareBox items={shown.length ? shown : all} />
            <Button variant="outline" onClick={() => window.print()}>
              <Printer />
              {s.print}
            </Button>
          </div>

          {/* Filters and sorting */}
          <div className="mt-6 flex flex-col gap-3 rounded-xl border border-border p-3 text-sm print:hidden">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-muted-foreground">{s.priority}:</span>
              {(["all", ...PRIORITIES, "none"] as const).map((p) => (
                <Chip key={p} active={priorityFilter === p} onClick={() => setPriorityFilter(p)}>
                  {p === "all" ? s.filterAll : p === "none" ? s.noPriority : s.priorities[p]}
                </Chip>
              ))}
            </div>
            {allTags.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="mr-1 text-muted-foreground">{s.tags}:</span>
                <Chip active={!tagFilter} onClick={() => setTagFilter("")}>
                  {s.filterAll}
                </Chip>
                {allTags.map((tag) => (
                  <Chip key={tag} active={tagFilter === tag} onClick={() => setTagFilter(tag)}>
                    {tag}
                  </Chip>
                ))}
              </div>
            )}
            <label className="flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground">{s.sortLabel}:</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="h-8 rounded-lg border border-border bg-background px-2"
              >
                {(Object.keys(s.sorts) as SortKey[]).map((k) => (
                  <option key={k} value={k}>
                    {s.sorts[k]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="sticky top-14 z-20 mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-background/95 p-3 backdrop-blur print:hidden">
            <p className="text-sm text-muted-foreground">{s.compareHint}</p>
            <Button
              disabled={selectedExisting.length < 2}
              onClick={() => router.push(`/compare?ids=${selectedExisting.join(",")}`)}
            >
              <Scale />
              {s.compare}
              {selectedExisting.length > 0 && ` (${selectedExisting.length})`}
            </Button>
          </div>

          {shown.length === 0 ? (
            <p className="mt-4 text-muted-foreground">{s.nothingMatches}</p>
          ) : (
            <ul className="mt-3 grid gap-3">
              {shown.map((u) => (
                <ShortlistCard key={u.qid} u={u} selected={selected.includes(u.qid)} onSelect={() => toggle(u.qid)} />
              ))}
            </ul>
          )}
        </>
      )}

      <DatesCalendar reminders={data.reminders} />
    </div>
  );
}

function Chip({ active, onClick, children, className }: { active: boolean; onClick: () => void; children: React.ReactNode; className?: string }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
        active ? "border-foreground bg-foreground text-background" : "border-border hover:bg-muted",
        className
      )}
    >
      {children}
    </button>
  );
}

function ShortlistCard({ u, selected, onSelect }: { u: SavedUniversity; selected: boolean; onSelect: () => void }) {
  const { t, locale } = useI18n();
  const s = t.saved;
  const [customTag, setCustomTag] = React.useState("");
  const fmt = (iso: string) => new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(iso));
  const step = u.step ?? "saved";
  const filledFacts = MY_FACT_KEYS.filter((k) => u.myFacts?.[k]).length;
  const tags = [...new Set([...s.presetTags, ...(u.tags ?? [])])];

  return (
    <li className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 break-inside-avoid">
      <div className="flex flex-col gap-3 md:flex-row">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <input
            type="checkbox"
            aria-label={`${s.compareHint}: ${u.label}`}
            checked={selected}
            onChange={onSelect}
            className="mt-1.5 size-4 accent-foreground print:hidden"
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Link href={`/university/${u.qid}`} className="text-lg font-semibold underline-offset-4 hover:underline">
                {u.label}
              </Link>
              {u.priority && (
                <span className={cn("rounded-full border px-2 py-0.5 text-xs font-medium", priorityStyles[u.priority])}>
                  {s.priorities[u.priority]}
                </span>
              )}
            </div>
            {(u.city || u.country) && (
              <p className="flex items-center gap-1 text-sm text-muted-foreground">
                <MapPin className="size-3.5" />
                {[u.city, u.country].filter(Boolean).join(", ")}
              </p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">{s.savedOn(fmt(u.savedAt))}</p>
            <div className="mt-2 flex gap-3 text-sm print:hidden">
              <Link href={`/university/${u.qid}`} className="font-medium underline-offset-4 hover:underline">
                {s.open}
              </Link>
              <button
                type="button"
                onClick={() => personal.toggleSaved(u)}
                className="flex items-center gap-1 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="size-3.5" />
                {s.remove}
              </button>
            </div>
          </div>
        </div>
        <label className="flex flex-col gap-1 text-sm md:w-80">
          <span className="text-muted-foreground">{s.note}</span>
          <textarea
            value={u.note}
            placeholder={s.notePlaceholder}
            onChange={(e) => personal.setNote(u.qid, e.target.value)}
            rows={3}
            maxLength={2000}
            className="rounded-lg border border-border bg-background p-2"
          />
        </label>
      </div>

      <div className="grid gap-4 text-sm md:grid-cols-2">
        {/* Priority */}
        <div className="flex flex-col gap-1.5">
          <span className="text-muted-foreground">{s.priority}</span>
          <div className="flex flex-wrap gap-1.5">
            {PRIORITIES.map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={u.priority === p}
                onClick={() => personal.setPriority(u.qid, u.priority === p ? undefined : p)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                  u.priority === p ? priorityStyles[p] : "border-border hover:bg-muted"
                )}
              >
                {s.priorities[p]}
              </button>
            ))}
          </div>
        </div>

        {/* Application tracker: click a step to move there. */}
        <div className="flex flex-col gap-1.5">
          <span className="text-muted-foreground">{s.tracker}</span>
          <ol className="flex items-center gap-1">
            {APPLICATION_STEPS.map((st, i) => {
              const done = APPLICATION_STEPS.indexOf(step) >= i;
              return (
                <li key={st} className="flex min-w-0 flex-1 items-center gap-1">
                  {i > 0 && <span className={cn("h-0.5 w-3 shrink-0 rounded", done ? "bg-emerald-600" : "bg-border")} />}
                  <button
                    type="button"
                    aria-current={step === st ? "step" : undefined}
                    onClick={() => personal.setStep(u.qid, st)}
                    className={cn(
                      "flex min-w-0 flex-1 items-center justify-center gap-1 rounded-lg border px-1.5 py-1 text-xs font-medium transition-colors",
                      done
                        ? "border-emerald-600/40 bg-emerald-600/10 text-emerald-800 dark:text-emerald-300"
                        : "border-border text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {done && <Check className="size-3 shrink-0" />}
                    <span className="truncate">{s.steps[st]}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>

        {/* Majors */}
        <div className="flex flex-col gap-1.5 md:col-span-2">
          <span className="text-muted-foreground">{s.tags}</span>
          <div className="flex flex-wrap items-center gap-1.5">
            {tags.map((tag) => {
              const on = !!u.tags?.includes(tag);
              return (
                <Chip key={tag} active={on} onClick={() => personal.toggleTag(u.qid, tag)} className={cn(!on && "print:hidden")}>
                  {tag}
                </Chip>
              );
            })}
            <form
              className="flex items-center gap-1 print:hidden"
              onSubmit={(e) => {
                e.preventDefault();
                personal.toggleTag(u.qid, customTag);
                setCustomTag("");
              }}
            >
              <input
                value={customTag}
                maxLength={30}
                placeholder={s.addTag}
                aria-label={s.addTag}
                onChange={(e) => setCustomTag(e.target.value)}
                className="h-7 w-32 rounded-full border border-border bg-background px-2.5 text-xs"
              />
            </form>
          </div>
        </div>
      </div>

      <details className="group rounded-lg border border-border text-sm">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 font-medium">
          <span>
            {s.myFactsTitle}
            {filledFacts > 0 && <span className="ml-1 text-muted-foreground">({filledFacts}/{MY_FACT_KEYS.length})</span>}
          </span>
          <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
        </summary>
        <div className="flex flex-col gap-3 border-t border-border p-3">
          <p className="text-xs text-muted-foreground">{s.myFactsHint}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {MY_FACT_KEYS.map((k) => (
              <MyFactField key={k} qid={u.qid} k={k} value={u.myFacts?.[k] ?? ""} />
            ))}
          </div>
        </div>
      </details>
    </li>
  );
}

function MyFactField({ qid, k, value }: { qid: string; k: MyFactKey; value: string }) {
  const { t } = useI18n();
  const s = t.saved;
  const cls = "h-9 rounded-lg border border-border bg-background px-2";
  const options = k === "military" || k === "dormGuarantee" ? s.yesNo : k === "dormType" ? s.dormTypes : undefined;
  return (
    <label className="flex flex-col gap-1">
      <span className="text-muted-foreground">{s.myFacts[k]}</span>
      {options ? (
        <select value={value} onChange={(e) => personal.setMyFact(qid, k, e.target.value)} className={cls}>
          {Object.entries(options).map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </select>
      ) : (
        <input
          value={value}
          maxLength={60}
          placeholder={s.myFactPlaceholders[k as keyof typeof s.myFactPlaceholders]}
          onChange={(e) => personal.setMyFact(qid, k, e.target.value)}
          className={cls}
        />
      )}
    </label>
  );
}

function ShareBox({ items }: { items: SavedUniversity[] }) {
  const { t } = useI18n();
  const s = t.saved;
  const [open, setOpen] = React.useState(false);
  const [withNotes, setWithNotes] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const url = open ? shareUrl(window.location.origin, items, withNotes) : "";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: the link is still selectable in the field.
    }
  };

  return (
    <div className="flex w-full flex-col gap-2">
      <div>
        <Button variant="outline" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          <Share2 />
          {s.share}
        </Button>
      </div>
      {open && (
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3 text-sm">
          <label className="font-medium" htmlFor="share-url">
            {s.shareTitle}
          </label>
          <div className="flex gap-2">
            <input
              id="share-url"
              readOnly
              value={url}
              onFocus={(e) => e.currentTarget.select()}
              className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-background px-2 text-xs"
            />
            <Button onClick={copy}>
              {copied ? <Check /> : <Copy />}
              {copied ? s.copied : s.copy}
            </Button>
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={withNotes} onChange={(e) => setWithNotes(e.target.checked)} className="size-4 accent-foreground" />
            {s.shareIncludeNotes}
          </label>
          <p className="text-xs text-muted-foreground">{s.shareHint}</p>
        </div>
      )}
    </div>
  );
}

function DatesCalendar({ reminders }: { reminders: Reminder[] }) {
  const { t, locale } = useI18n();
  const s = t.saved;
  const o = t.profile.openDays;
  const download = useReminderDownload();
  const fmtDay = (d: string) =>
    new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));
  const fmtMonth = (d: string) =>
    new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${d.slice(0, 7)}-01T00:00:00Z`));

  const months = new Map<string, Reminder[]>();
  for (const r of reminders) {
    const key = r.date.slice(0, 7);
    months.set(key, [...(months.get(key) ?? []), r]);
  }

  const downloadAll = () =>
    downloadFile(
      "uniview-dates.ics",
      calendarIcs(reminders.map((r) => ({ r, title: `${o.types[r.type ?? "openDay"]}: ${r.label}`, description: reminderDetails(r, o) }))),
      "text/calendar"
    );

  return (
    <section className="mt-10 break-inside-avoid">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <CalendarDays className="size-6" />
          {s.reminders}
        </h2>
        {reminders.length > 0 && (
          <Button variant="outline" onClick={downloadAll} className="print:hidden">
            <Download />
            {s.downloadAll}
          </Button>
        )}
      </div>
      {reminders.length === 0 ? (
        <p className="mt-3 text-muted-foreground">{s.noReminders}</p>
      ) : (
        <div className="mt-3 flex flex-col gap-4">
          {[...months.entries()].map(([month, list]) => (
            <div key={month}>
              <h3 className="mb-2 text-sm font-semibold capitalize text-muted-foreground">{fmtMonth(month)}</h3>
              <ul className="grid gap-2">
                {list.map((r) => {
                  const days = daysUntil(r.date);
                  return (
                    <li
                      key={r.id}
                      className={cn(
                        "flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-3 text-sm",
                        days < 0 && "opacity-60"
                      )}
                    >
                      <span className="flex flex-col gap-0.5">
                        <span>
                          <span className="font-medium">
                            {fmtDay(r.date)}
                            {r.time && `, ${r.time}`}
                          </span>
                          <span
                            className={cn(
                              "ml-2 rounded-full px-2 py-0.5 text-xs",
                              days >= 0 && days <= 7 ? "bg-amber-500/15 text-amber-800 dark:text-amber-300" : "bg-muted text-muted-foreground"
                            )}
                          >
                            {s.daysLeft(days)}
                          </span>
                        </span>
                        <span>
                          <span className="font-medium">{o.types[r.type ?? "openDay"]}</span>
                          {" · "}
                          <Link href={`/university/${r.qid}`} className="underline-offset-4 hover:underline">
                            {r.label}
                          </Link>
                          {reminderDetails(r, o) && <span className="text-muted-foreground"> · {reminderDetails(r, o)}</span>}
                        </span>
                      </span>
                      <span className="flex gap-1 print:hidden">
                        <Button variant="outline" size="sm" onClick={() => download(r)}>
                          <Download />
                          {o.ics}
                        </Button>
                        <Button variant="ghost" size="icon-sm" aria-label={o.remove} onClick={() => personal.removeReminder(r.id)}>
                          <Trash2 />
                        </Button>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
