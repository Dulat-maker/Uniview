"use client";

import React from "react";
import Image from "next/image";
import { GraduationCap, Loader2, MapPin, Search, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/i18n-provider";
import type { SearchResponse, UniversityCandidate } from "@/lib/types";

type PickerState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "done"; candidates: UniversityCandidate[]; query: string };

/** Search box that lists matching universities and lets the user pick one (no navigation). */
export function UniversityPicker({
  title,
  exclude,
  onPick,
}: {
  title: string;
  /** Universities already chosen, hidden from the results. */
  exclude?: string[];
  onPick: (qid: string) => void;
}) {
  const { t, locale } = useI18n();
  const [query, setQuery] = React.useState("");
  const [state, setState] = React.useState<PickerState>({ kind: "idle" });

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (q.length < 2) return;
    setState({ kind: "loading" });
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&lang=${locale}`, {
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as SearchResponse;
      setState({ kind: "done", query: q, candidates: data.candidates.filter((c) => !exclude?.includes(c.qid)) });
    } catch {
      setState({ kind: "error" });
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h2 className="font-semibold">{title}</h2>
      <form onSubmit={search} className="mt-3 flex items-center gap-2 rounded-xl border border-border bg-background p-1.5">
        <Search className="ml-2 size-4 shrink-0 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.hero.placeholder}
          aria-label={title}
          maxLength={100}
          className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        <Button type="submit" size="lg" disabled={state.kind === "loading"}>
          {t.hero.search}
        </Button>
      </form>

      {state.kind === "loading" && (
        <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          {t.search.searching}
        </p>
      )}
      {state.kind === "error" && <p className="mt-3 text-sm text-destructive">{t.search.error}</p>}
      {state.kind === "done" && state.candidates.length === 0 && (
        <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
          <SearchX className="size-4" />
          {t.search.none(state.query)}
        </p>
      )}
      {state.kind === "done" && state.candidates.length > 0 && (
        <ul className="mt-3 grid gap-2">
          {state.candidates.map((c) => (
            <li key={c.qid}>
              <button
                type="button"
                onClick={() => onPick(c.qid)}
                className="flex w-full items-center gap-3 rounded-xl border border-border p-3 text-left transition-colors hover:bg-muted/60"
              >
                <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                  {c.imageUrl ? (
                    <Image src={c.imageUrl} alt="" width={40} height={40} unoptimized className="size-full object-contain" />
                  ) : (
                    <GraduationCap className="size-5 text-muted-foreground" />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block font-medium">{c.label}</span>
                  {(c.city || c.country) && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="size-3" />
                      {[c.city, c.country].filter(Boolean).join(", ")}
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
