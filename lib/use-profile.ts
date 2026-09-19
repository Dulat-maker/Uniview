"use client";

import React from "react";
import { useI18n } from "@/components/i18n-provider";
import { TIME_LIMIT_MS, type ProfileEvent, type ProfileStage, type UniversityProfile } from "@/lib/types";

export type ProfileViewState =
  | { kind: "loading"; stage: ProfileStage | null }
  | { kind: "error"; code: "not_found" | "upstream" | "timeout" }
  | { kind: "done"; profile: UniversityProfile };

/**
 * Streams a university profile from /api/university/[qid] (stage events, then the result),
 * aborting at the 30-second limit. State is keyed by qid|locale|attempt so no setState runs
 * synchronously inside the effect; `retry` starts a new attempt.
 */
export function useProfile(qid: string | undefined) {
  const { locale } = useI18n();
  const [attempt, setAttempt] = React.useState(0);
  const key = `${qid}|${locale}|${attempt}`;

  const [view, setView] = React.useState<{ key: string; state: ProfileViewState } | null>(null);
  const state: ProfileViewState = view?.key === key ? view.state : { kind: "loading", stage: null };

  const [tick, setTick] = React.useState({ key, seconds: 0 });
  const seconds = tick.key === key ? tick.seconds : 0;

  React.useEffect(() => {
    // No university in this slot (the compare page always calls the hook for all 4 slots).
    if (!qid) return;
    const controller = new AbortController();
    const timeLimit = AbortSignal.timeout(TIME_LIMIT_MS);
    const timer = setInterval(
      () => setTick((prev) => (prev.key === key ? { key, seconds: prev.seconds + 1 } : { key, seconds: 1 })),
      1000
    );
    const finish = (next: ProfileViewState) => {
      clearInterval(timer);
      setView({ key, state: next });
    };

    (async () => {
      try {
        const res = await fetch(`/api/university/${qid}?lang=${locale}`, {
          signal: AbortSignal.any([controller.signal, timeLimit]),
        });
        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
        const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
        let buffer = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += value;
          let newline: number;
          while ((newline = buffer.indexOf("\n")) >= 0) {
            const line = buffer.slice(0, newline).trim();
            buffer = buffer.slice(newline + 1);
            if (!line) continue;
            const event = JSON.parse(line) as ProfileEvent;
            if (event.type === "stage") setView({ key, state: { kind: "loading", stage: event.stage } });
            else if (event.type === "result") return finish({ kind: "done", profile: event.profile });
            else return finish({ kind: "error", code: event.code });
          }
        }
        throw new Error("stream ended early");
      } catch {
        if (controller.signal.aborted) return;
        finish({ kind: "error", code: timeLimit.aborted ? "timeout" : "upstream" });
      }
    })();

    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [key, qid, locale]);

  const retry = React.useCallback(() => setAttempt((a) => a + 1), []);
  return { state, seconds, retry };
}
