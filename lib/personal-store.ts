"use client";

// Personal data (saved universities, notes, open-day reminders, packing checklists).
// There are no accounts, so it lives in this browser's localStorage; the UI says so.
import React from "react";

export const PRIORITIES = ["first", "backup", "dream"] as const;
export type Priority = (typeof PRIORITIES)[number];

/** Application tracker: saved → documents submitted → original certificate handed in. */
export const APPLICATION_STEPS = ["saved", "submitted", "original"] as const;
export type ApplicationStep = (typeof APPLICATION_STEPS)[number];

/** Facts with no open data source; the user copies them from the university's website. */
export const MY_FACT_KEYS = [
  "passingScore",
  "budgetPlaces",
  "tuition",
  "military",
  "dormGuarantee",
  "dormCost",
  "dormType",
] as const;
export type MyFactKey = (typeof MY_FACT_KEYS)[number];

export type SavedUniversity = {
  qid: string;
  label: string;
  city?: string;
  country?: string;
  website?: string;
  savedAt: string;
  note: string;
  priority?: Priority;
  /** Majors the user is interested in here ("IT", "Design"…). */
  tags?: string[];
  step?: ApplicationStep;
  myFacts?: Partial<Record<MyFactKey, string>>;
};

export type SavedInfo = Pick<SavedUniversity, "qid" | "label" | "city" | "country" | "website">;

export const DATE_TYPES = ["openDay", "applicationsOpen", "originalsDeadline", "exam", "other"] as const;
export type DateType = (typeof DATE_TYPES)[number];

export type Reminder = {
  id: string;
  qid: string;
  label: string;
  /** Missing on reminders created before date types existed: those are open days. */
  type?: DateType;
  /** YYYY-MM-DD */
  date: string;
  /** HH:MM, optional */
  time?: string;
  kind: "online" | "offline";
  note: string;
};

export type Checklist = {
  packed: string[];
  /** What the chosen dorm provides, as the user found out ("yes" = provided, "no" = bring it). */
  provided: Record<string, "yes" | "no">;
};

export type PersonalData = {
  saved: Record<string, SavedUniversity>;
  reminders: Reminder[];
  checklists: Record<string, Checklist>;
  /** ISO2 code of the user's own country, for cost-of-living comparisons. */
  homeCountry?: string;
};

const KEY = "uniview-personal";
const EMPTY: PersonalData = { saved: {}, reminders: [], checklists: {} };
const listeners = new Set<() => void>();
let cache: PersonalData | null = null;

function read(): PersonalData {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<PersonalData>) : {};
    cache = { ...EMPTY, ...parsed };
  } catch {
    cache = EMPTY;
  }
  return cache;
}

function write(next: PersonalData) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage blocked (private mode): keep it in memory for this visit.
  }
  listeners.forEach((l) => l());
}

function subscribe(callback: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY) return;
    cache = null;
    callback();
  };
  listeners.add(callback);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", onStorage);
  };
}

function updateSaved(qid: string, patch: Partial<SavedUniversity>) {
  const d = read();
  if (!d.saved[qid]) return;
  write({ ...d, saved: { ...d.saved, [qid]: { ...d.saved[qid], ...patch } } });
}

export const personal = {
  toggleSaved(u: SavedInfo) {
    const d = read();
    const saved = { ...d.saved };
    if (saved[u.qid]) delete saved[u.qid];
    else saved[u.qid] = { ...u, savedAt: new Date().toISOString(), note: "" };
    write({ ...d, saved });
  },
  ensureSaved(u: SavedInfo) {
    const d = read();
    if (!d.saved[u.qid]) write({ ...d, saved: { ...d.saved, [u.qid]: { ...u, savedAt: new Date().toISOString(), note: "" } } });
  },
  setNote(qid: string, note: string) {
    updateSaved(qid, { note });
  },
  setPriority(qid: string, priority: Priority | undefined) {
    updateSaved(qid, { priority });
  },
  setStep(qid: string, step: ApplicationStep) {
    updateSaved(qid, { step });
  },
  toggleTag(qid: string, tag: string) {
    const current = read().saved[qid]?.tags ?? [];
    const clean = tag.trim().slice(0, 30);
    if (!clean) return;
    const has = current.some((x) => x.toLowerCase() === clean.toLowerCase());
    updateSaved(qid, { tags: has ? current.filter((x) => x.toLowerCase() !== clean.toLowerCase()) : [...current, clean].slice(0, 8) });
  },
  setMyFact(qid: string, key: MyFactKey, value: string) {
    const current = read().saved[qid]?.myFacts ?? {};
    updateSaved(qid, { myFacts: { ...current, [key]: value.slice(0, 200) } });
  },
  /** Adds universities from a shared link without overwriting what the user already has. */
  importShared(items: SavedUniversity[]) {
    const d = read();
    const saved = { ...d.saved };
    for (const u of items) if (!saved[u.qid]) saved[u.qid] = { ...u, savedAt: new Date().toISOString() };
    write({ ...d, saved });
  },
  addReminder(r: Omit<Reminder, "id">) {
    const d = read();
    const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    write({ ...d, reminders: [...d.reminders, { ...r, id }].sort((a, b) => a.date.localeCompare(b.date)) });
  },
  removeReminder(id: string) {
    const d = read();
    write({ ...d, reminders: d.reminders.filter((r) => r.id !== id) });
  },
  setHomeCountry(iso2: string | undefined) {
    write({ ...read(), homeCountry: iso2 });
  },
  updateChecklist(key: string, update: (c: Checklist) => Checklist) {
    const d = read();
    const current = d.checklists[key] ?? { packed: [], provided: {} };
    write({ ...d, checklists: { ...d.checklists, [key]: update(current) } });
  },
};

// Server render and first client render use the empty state, then the saved data appears.
const getServerSnapshot = () => EMPTY;

export function usePersonal() {
  return React.useSyncExternalStore(subscribe, read, getServerSnapshot);
}

/** An .ics calendar file; every event has a notification one day before, so calendar apps remind the user. */
export function calendarIcs(events: { r: Reminder; title: string; description: string }[]) {
  const esc = (s: string) => s.replace(/[\\;,]/g, (m) => `\\${m}`).replace(/\r?\n/g, "\\n");
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Uniview//Important dates//EN"];
  for (const { r, title, description } of events) {
    const date = r.date.replace(/-/g, "");
    lines.push(
      "BEGIN:VEVENT",
      `UID:${r.id}@uniview`,
      `DTSTAMP:${stamp}`,
      r.time ? `DTSTART:${date}T${r.time.replace(":", "")}00` : `DTSTART;VALUE=DATE:${date}`,
      `SUMMARY:${esc(title)}`,
      `DESCRIPTION:${esc(description)}`,
      "BEGIN:VALARM",
      "TRIGGER:-P1D",
      "ACTION:DISPLAY",
      `DESCRIPTION:${esc(title)}`,
      "END:VALARM",
      "END:VEVENT"
    );
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export function reminderIcs(r: Reminder, title: string, description: string) {
  return calendarIcs([{ r, title, description }]);
}

export function downloadFile(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
