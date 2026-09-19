"use client";

import React from "react";
import Link from "next/link";
import { Check, Heart, MapPin, Scale, Share2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { useI18n } from "@/components/i18n-provider";
import { priorityStyles } from "@/components/saved-view";
import { APPLICATION_STEPS, MY_FACT_KEYS, personal } from "@/lib/personal-store";
import { readShared } from "@/lib/share";
import { cn } from "@/lib/utils";

// The list lives in the URL fragment; read it as external state (it changes if another link is pasted).
const subscribe = (cb: () => void) => {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
};

/** Read-only view of a shortlist someone shared by link. */
export function SharedView() {
  const { t } = useI18n();
  const s = t.saved;
  const hash = React.useSyncExternalStore(subscribe, () => window.location.hash, () => null);
  const items = React.useMemo(() => (hash ? readShared(hash) : undefined), [hash]);
  const [added, setAdded] = React.useState(false);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="flex items-center gap-2 text-3xl font-semibold tracking-tight md:text-4xl">
        <Share2 className="size-7" />
        {s.sharedTitle}
      </h1>
      <p className="mt-1 text-muted-foreground">{s.sharedSubtitle}</p>

      {hash === null ? null : !items?.length ? (
        <p className="mt-8 rounded-xl border border-dashed border-border p-6 text-muted-foreground">{s.sharedInvalid}</p>
      ) : (
        <>
          <div className="mt-6 flex flex-wrap gap-2">
            <Button
              onClick={() => {
                personal.importShared(items);
                setAdded(true);
              }}
              disabled={added}
            >
              {added ? <Check /> : <Heart />}
              {added ? s.sharedAdded : s.sharedAdd}
            </Button>
            {items.length >= 2 && (
              <Link
                href={`/compare?ids=${items.slice(0, 4).map((u) => u.qid).join(",")}`}
                className={buttonVariants({ variant: "outline" })}
              >
                <Scale />
                {s.sharedCompare}
              </Link>
            )}
          </div>
          <ul className="mt-6 grid gap-3">
            {items.map((u) => (
              <li key={u.qid} className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4 text-sm">
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
                  <p className="flex items-center gap-1 text-muted-foreground">
                    <MapPin className="size-3.5" />
                    {[u.city, u.country].filter(Boolean).join(", ")}
                  </p>
                )}
                <p>
                  <span className="text-muted-foreground">{s.tracker}: </span>
                  <span className="font-medium">{s.steps[u.step ?? APPLICATION_STEPS[0]]}</span>
                </p>
                {!!u.tags?.length && (
                  <p>
                    <span className="text-muted-foreground">{s.tags}: </span>
                    {u.tags.join(", ")}
                  </p>
                )}
                {u.note && (
                  <p className="whitespace-pre-line rounded-lg bg-muted/60 p-2">
                    <span className="text-muted-foreground">{s.sharedNotes}: </span>
                    {u.note}
                  </p>
                )}
                {u.myFacts && MY_FACT_KEYS.some((k) => u.myFacts?.[k]) && (
                  <ul className="grid gap-0.5">
                    {MY_FACT_KEYS.filter((k) => u.myFacts?.[k]).map((k) => (
                      <li key={k}>
                        <span className="text-muted-foreground">{s.myFacts[k]}: </span>
                        {factText(k, u.myFacts![k]!, s)}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

type SavedText = ReturnType<typeof useI18n>["t"]["saved"];
/** Human text for a user-entered fact (select values are stored as keys like "yes" or "block"). */
export function factText(k: (typeof MY_FACT_KEYS)[number], value: string, s: SavedText) {
  if (k === "military" || k === "dormGuarantee") return s.yesNo[value as keyof typeof s.yesNo] ?? value;
  if (k === "dormType") return s.dormTypes[value as keyof typeof s.dormTypes] ?? value;
  return value;
}
