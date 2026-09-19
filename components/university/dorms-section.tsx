"use client";

import React from "react";
import { BedDouble, ClipboardCheck, ExternalLink, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/i18n-provider";
import { Rich } from "@/components/rich-text";
import { TrustBadge } from "@/components/trust-badge";
import { personal, usePersonal } from "@/lib/personal-store";
import type { Dorm, UniversityProfile } from "@/lib/types";
import { cn } from "@/lib/utils";

type ItemKey = keyof ReturnType<typeof useI18n>["t"]["profile"]["dorms"]["items"];

// `dorm: true` = depends on what the dorm provides (fridge, bedding…), which no open source lists.
const ITEMS: { key: ItemKey; dorm?: boolean }[] = [
  { key: "passport" },
  { key: "admission" },
  { key: "photos" },
  { key: "medical" },
  { key: "money" },
  { key: "bedding", dorm: true },
  { key: "towels" },
  { key: "fridge", dorm: true },
  { key: "internet", dorm: true },
  { key: "kettle", dorm: true },
  { key: "cookware", dorm: true },
  { key: "lamp", dorm: true },
  { key: "extension" },
  { key: "laundry" },
  { key: "hygiene" },
  { key: "firstaid" },
  { key: "laptop" },
];

// Straight-line distance × 1.3 for streets, at ~80 m per minute.
const walkMinutes = (m: number) => Math.max(1, Math.round((m * 1.3) / 80));

export function DormsSection({ profile }: { profile: UniversityProfile }) {
  const { t, locale } = useI18n();
  const d = t.profile.dorms;
  const dorms = profile.facts.dorms;
  const [selected, setSelected] = React.useState<string>("any");
  const nameOf = (dorm: Dorm) => (locale === "ru" ? dorm.nameRu : dorm.nameEn) ?? dorm.name;
  const km = (m: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(m / 1000);

  return (
    // grid-cols-1 (= minmax(0,1fr)) stops the wide table from stretching the page on phones.
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-card p-5">
        <h3 className="flex items-center gap-2 font-semibold">
          <BedDouble className="size-5 text-muted-foreground" />
          {d.tableTitle}
        </h3>
        {!dorms ? (
          <p className="text-sm text-muted-foreground">{d.noData}</p>
        ) : dorms.list.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {d.none} {dorms.unnamed > 0 && d.unnamed(dorms.unnamed)}
          </p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              <Rich text={d.tableHint(dorms.list.length)} /> {dorms.unnamed > 0 && d.unnamed(dorms.unnamed)}
            </p>
            <div className="-mx-5 overflow-x-auto px-5">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr className="border-b border-border">
                    {[d.cols.name, d.cols.distance, d.cols.internet, d.cols.price, d.cols.kitchen, d.cols.room].map((c) => (
                      <th key={c} className="py-2 pr-3 font-medium">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dorms.list.map((dorm) => (
                    <tr
                      key={dorm.name}
                      className={cn("border-b border-border last:border-0", selected === dorm.name && "bg-muted/60")}
                    >
                      <td className="py-2 pr-3">
                        <button
                          type="button"
                          onClick={() => setSelected(dorm.name)}
                          className="text-left font-medium underline-offset-4 hover:underline"
                        >
                          {nameOf(dorm)}
                        </button>
                        {dorm.website && (
                          <a href={dorm.website} target="_blank" rel="noopener noreferrer" className="ml-1 inline-flex text-muted-foreground">
                            <ExternalLink className="size-3" />
                          </a>
                        )}
                      </td>
                      <td className="whitespace-nowrap py-2 pr-3 tabular-nums">{d.walk(km(dorm.distanceM), walkMinutes(dorm.distanceM))}</td>
                      <td className="py-2 pr-3">
                        {dorm.internet ? (
                          <>
                            {d.internet[dorm.internet] ?? dorm.internet}
                            {dorm.internetFee && ` (${dorm.internetFee === "no" ? d.free : d.paid})`}
                          </>
                        ) : (
                          <span className="text-muted-foreground">{d.unknown}</span>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-muted-foreground">{d.unknown}</td>
                      <td className="py-2 pr-3 text-muted-foreground">{d.unknown}</td>
                      <td className="py-2 pr-3 text-muted-foreground">{d.unknown}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="flex items-start gap-2 text-xs text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0" />
              {d.honestNote}
            </p>
            <TrustBadge className="self-start" level="medium" source="OpenStreetMap" hint={t.trust.hints.transport} />
          </>
        )}
      </div>

      <Checklist
        qid={profile.qid}
        dormKey={selected}
        dormOptions={(dorms?.list ?? []).map((dorm) => ({ value: dorm.name, label: nameOf(dorm) }))}
        onDormChange={setSelected}
      />
    </div>
  );
}

function Checklist({
  qid,
  dormKey,
  dormOptions,
  onDormChange,
}: {
  qid: string;
  dormKey: string;
  dormOptions: { value: string; label: string }[];
  onDormChange: (v: string) => void;
}) {
  const { t } = useI18n();
  const d = t.profile.dorms;
  const data = usePersonal();
  const key = `${qid}|${dormKey}`;
  const list = data.checklists[key] ?? { packed: [], provided: {} };

  const toPack = ITEMS.filter((i) => list.provided[i.key] !== "yes");
  const done = toPack.filter((i) => list.packed.includes(i.key)).length;

  const togglePacked = (item: string) =>
    personal.updateChecklist(key, (c) => ({
      ...c,
      packed: c.packed.includes(item) ? c.packed.filter((x) => x !== item) : [...c.packed, item],
    }));
  const setProvided = (item: string, value: "unknown" | "yes" | "no") =>
    personal.updateChecklist(key, (c) => {
      const provided = { ...c.provided };
      if (value === "unknown") delete provided[item];
      else provided[item] = value;
      return { ...c, provided };
    });

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
      <h3 className="flex items-center gap-2 font-semibold">
        <ClipboardCheck className="size-5 text-muted-foreground" />
        {d.checklistTitle}
      </h3>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted-foreground">{d.checklistFor}</span>
        <select
          value={dormKey}
          onChange={(e) => onDormChange(e.target.value)}
          className="h-9 rounded-lg border border-border bg-background px-2 text-sm"
        >
          <option value="any">{d.anyDorm}</option>
          {dormOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <p className="text-xs text-muted-foreground">{d.checklistHint}</p>
      <p className="text-sm font-medium tabular-nums">{d.progress(done, toPack.length)}</p>

      <ul className="grid gap-1.5 text-sm">
        {ITEMS.map((item) => {
          const provided = list.provided[item.key];
          const notNeeded = provided === "yes";
          return (
            <li key={item.key} className="flex items-center gap-2">
              <input
                type="checkbox"
                id={`${key}-${item.key}`}
                checked={list.packed.includes(item.key)}
                disabled={notNeeded}
                onChange={() => togglePacked(item.key)}
                className="size-4 accent-foreground"
              />
              <label
                htmlFor={`${key}-${item.key}`}
                className={cn("flex-1", notNeeded && "text-muted-foreground line-through")}
              >
                {d.items[item.key]}
              </label>
              {item.dorm && (
                <select
                  aria-label={d.items[item.key]}
                  value={provided ?? "unknown"}
                  onChange={(e) => setProvided(item.key, e.target.value as "unknown" | "yes" | "no")}
                  className="h-7 rounded-md border border-border bg-background px-1 text-xs"
                >
                  <option value="unknown">{d.provided.unknown}</option>
                  <option value="yes">{d.provided.yes}</option>
                  <option value="no">{d.provided.no}</option>
                </select>
              )}
            </li>
          );
        })}
      </ul>
      <div className="mt-auto flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{d.storedLocally}</span>
        <Button variant="ghost" size="sm" onClick={() => personal.updateChecklist(key, () => ({ packed: [], provided: {} }))}>
          {d.reset}
        </Button>
      </div>
    </div>
  );
}
