"use client";

import React from "react";
import {
  CalendarPlus,
  Download,
  ExternalLink,
  Info,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/i18n-provider";
import {
  DATE_TYPES,
  downloadFile,
  personal,
  reminderIcs,
  usePersonal,
  type DateType,
  type Reminder,
} from "@/lib/personal-store";
import type { UniversityProfile } from "@/lib/types";

/** Online / on campus only makes sense for events you attend. */
const hasFormat = (type: DateType) => type === "openDay" || type === "exam";

type OpenDayText = ReturnType<typeof useI18n>["t"]["profile"]["openDays"];
export function reminderDetails(r: Reminder, o: OpenDayText) {
  const type = r.type ?? "openDay";
  return [
    hasFormat(type) ? (r.kind === "online" ? o.online : o.offline) : "",
    r.note,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function useReminderDownload() {
  const { t } = useI18n();
  return (r: Reminder) =>
    downloadFile(
      `${r.type ?? "openDay"}-${r.date}.ics`,
      reminderIcs(
        r,
        `${t.profile.openDays.types[r.type ?? "openDay"]}: ${r.label}`,
        reminderDetails(r, t.profile.openDays),
      ),
      "text/calendar",
    );
}

export function OpenDays({ profile }: { profile: UniversityProfile }) {
  const { t, locale } = useI18n();
  const o = t.profile.openDays;
  const data = usePersonal();
  const download = useReminderDownload();
  const [form, setForm] = React.useState({
    type: "openDay" as DateType,
    date: "",
    time: "",
    kind: "offline" as "online" | "offline",
    note: "",
  });

  const host = profile.website
    ? new URL(profile.website).hostname.replace(/^www\./, "")
    : undefined;
  const search = (words: string) =>
    `https://www.google.com/search?q=${encodeURIComponent(host ? `site:${host} ${words}` : `"${profile.label}" ${words}`)}`;
  const reminders = data.reminders.filter((r) => r.qid === profile.qid);
  const dateLabel = (r: Reminder) =>
    new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeZone: "UTC",
    }).format(new Date(`${r.date}T00:00:00Z`)) + (r.time ? `, ${r.time}` : "");

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.date) return;
    // Adding a reminder also saves the university, so it shows up in "My universities".
    personal.ensureSaved({
      qid: profile.qid,
      label: profile.label,
      city: profile.city,
      country: profile.country,
      website: profile.website,
    });
    personal.addReminder({
      qid: profile.qid,
      label: profile.label,
      type: form.type,
      date: form.date,
      time: form.time || undefined,
      kind: form.kind,
      note: form.note.trim(),
    });
    setForm({ ...form, date: "", time: "", note: "" });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 text-sm">
        <p className="flex items-start gap-2 text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0" />
          {o.honest}
        </p>
        <a
          href={search(o.searchOpenDay)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 font-medium underline-offset-4 hover:underline"
        >
          {o.findOfficial}
          <ExternalLink className="size-3.5" />
        </a>
        <a
          href={search(o.searchTour)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 font-medium underline-offset-4 hover:underline"
        >
          {o.findTours}
          <ExternalLink className="size-3.5" />
        </a>
        <a
          href={search(o.searchAdmission)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 font-medium underline-offset-4 hover:underline"
        >
          {o.findAdmission}
          <ExternalLink className="size-3.5" />
        </a>

        <h3 className="mt-2 font-semibold">{o.list}</h3>
        {reminders.length === 0 ? (
          <p className="text-muted-foreground">{o.none}</p>
        ) : (
          <ul className="grid gap-2">
            {reminders.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-2.5"
              >
                <span>
                  <span className="font-medium">{dateLabel(r)}</span>
                  {" · "}
                  {o.types[r.type ?? "openDay"]}
                  <span className="text-muted-foreground">
                    {reminderDetails(r, o) && ` · ${reminderDetails(r, o)}`}
                  </span>
                </span>
                <span className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => download(r)}
                  >
                    <Download />
                    {o.ics}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={o.remove}
                    onClick={() => personal.removeReminder(r.id)}
                  >
                    <Trash2 />
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <form
        onSubmit={add}
        className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 text-sm"
      >
        <h3 className="flex items-center gap-2 font-semibold">
          <CalendarPlus className="size-5 text-muted-foreground" />
          {o.addTitle}
        </h3>
        <label className="flex flex-col gap-1">
          <span className="text-muted-foreground">{o.type}</span>
          <select
            value={form.type}
            onChange={(e) =>
              setForm({ ...form, type: e.target.value as DateType })
            }
            className="h-9 rounded-lg border border-border bg-background px-2"
          >
            {DATE_TYPES.map((d) => (
              <option key={d} value={d}>
                {o.types[d]}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-muted-foreground">{o.date}</span>
            <input
              type="date"
              required
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="h-9 rounded-lg border border-border bg-background px-2"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-muted-foreground">{o.time}</span>
            <input
              type="time"
              value={form.time}
              onChange={(e) => setForm({ ...form, time: e.target.value })}
              className="h-9 rounded-lg border border-border bg-background px-2"
            />
          </label>
        </div>
        {hasFormat(form.type) && (
          <fieldset className="flex flex-col gap-1">
            <legend className="mb-1 text-muted-foreground">{o.kind}</legend>
            <div className="flex gap-4">
              {(["offline", "online"] as const).map((k) => (
                <label key={k} className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    name="kind"
                    checked={form.kind === k}
                    onChange={() => setForm({ ...form, kind: k })}
                    className="accent-foreground"
                  />
                  {o[k]}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        <label className="flex flex-col gap-1">
          <span className="text-muted-foreground">{o.note}</span>
          <input
            value={form.note}
            maxLength={120}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
            className="h-9 rounded-lg border border-border bg-background px-2"
          />
        </label>
        <Button type="submit" className="self-start">
          {o.add}
        </Button>
        <p className="text-xs text-muted-foreground">
          {o.icsHint} {t.profile.dorms.storedLocally}
        </p>
      </form>
    </div>
  );
}
