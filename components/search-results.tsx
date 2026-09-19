"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ChevronRight, GraduationCap, Loader2, MapPin, SearchX } from "lucide-react";
import { SaveButton } from "@/components/save-button";
import { SearchBox } from "@/components/search-box";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/i18n-provider";
import type { SearchResponse } from "@/lib/types";

type State =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "done"; data: SearchResponse };

export function SearchResults({ query }: { query: string }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [attempt, setAttempt] = React.useState(0);
  const [result, setResult] = React.useState<{ key: string; state: State } | null>(null);
  const key = `${query}|${locale}|${attempt}`;
  const state: State = result?.key === key ? result.state : { kind: "loading" };

  React.useEffect(() => {
    if (query.length < 2) return;
    const controller = new AbortController();
    fetch(`/api/search?q=${encodeURIComponent(query)}&lang=${locale}`, {
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as SearchResponse;
        // Exactly one match isn't ambiguous: go straight to the profile.
        if (data.candidates.length === 1) router.replace(`/university/${data.candidates[0].qid}`);
        setResult({ key, state: { kind: "done", data } });
      })
      .catch(() => {
        if (!controller.signal.aborted) setResult({ key, state: { kind: "error" } });
      });
    return () => controller.abort();
  }, [query, locale, key, router]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <SearchBox defaultValue={query} className="max-w-none" />

      {query.length < 2 ? (
        <p className="mt-8 text-muted-foreground">{t.search.empty}</p>
      ) : (
        <>
          <h1 className="mt-8 text-2xl font-semibold tracking-tight">{t.search.title(query)}</h1>

          {state.kind === "loading" && (
            <p className="mt-4 flex items-center gap-2 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {t.search.searching}
            </p>
          )}

          {state.kind === "error" && (
            <div className="mt-6 flex flex-col items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
              <p className="flex items-center gap-2 text-sm">
                <AlertTriangle className="size-4 text-destructive" />
                {t.search.error}
              </p>
              <Button variant="outline" onClick={() => setAttempt((a) => a + 1)}>
                {t.search.retry}
              </Button>
            </div>
          )}

          {state.kind === "done" && (
            <>
              {state.data.partial && (
                <p className="mt-4 flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="size-4" />
                  {t.search.partial}
                </p>
              )}

              {state.data.candidates.length === 0 && (
                <div className="mt-6 flex flex-col items-start gap-2 rounded-xl border border-border p-5">
                  <p className="flex items-center gap-2 font-medium">
                    <SearchX className="size-5 text-muted-foreground" />
                    {t.search.none(query)}
                  </p>
                  <p className="text-sm text-muted-foreground">{t.search.noneHint}</p>
                </div>
              )}

              {state.data.candidates.length === 1 && (
                <p className="mt-4 flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  {t.search.opening}
                </p>
              )}

              {state.data.candidates.length > 1 && (
                <>
                  <p className="mt-2 text-muted-foreground">{t.search.choose}</p>
                  <ul className="mt-6 grid gap-3">
                    {state.data.candidates.map((c) => (
                      <li key={c.qid} className="flex items-center gap-2">
                        <Link
                          href={`/university/${c.qid}`}
                          className="group flex min-w-0 flex-1 items-center gap-4 rounded-xl border border-border bg-card p-4 transition-colors hover:border-foreground/30 hover:bg-muted/50"
                        >
                          <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                            {c.imageUrl ? (
                              <Image
                                src={c.imageUrl}
                                alt=""
                                width={56}
                                height={56}
                                unoptimized
                                className="size-full object-contain"
                              />
                            ) : (
                              <GraduationCap className="size-6 text-muted-foreground" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium">{c.label}</p>
                            {c.description && (
                              <p className="truncate text-sm text-muted-foreground">{c.description}</p>
                            )}
                            {(c.city || c.country) && (
                              <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                                <MapPin className="size-3" />
                                {[c.city, c.country].filter(Boolean).join(", ")}
                              </p>
                            )}
                          </div>
                          <ChevronRight className="size-5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                        </Link>
                        <SaveButton compact info={{ qid: c.qid, label: c.label, city: c.city, country: c.country }} />
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
