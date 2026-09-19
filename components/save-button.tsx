"use client";

import { Heart } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { personal, usePersonal, type SavedInfo } from "@/lib/personal-store";
import { cn } from "@/lib/utils";

/** One-click "save to my shortlist". `compact` is an icon-only heart for result cards. */
export function SaveButton({ info, compact = false }: { info: SavedInfo; compact?: boolean }) {
  const { t } = useI18n();
  const data = usePersonal();
  const saved = !!data.saved[info.qid];
  const label = saved ? t.profile.savedLabel : t.profile.save;

  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={compact ? `${label}: ${info.label}` : undefined}
      title={compact ? label : undefined}
      onClick={() => personal.toggleSaved(info)}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border text-sm font-medium transition-colors",
        compact ? "size-10 justify-center" : "px-3 py-1.5",
        saved ? "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-400" : "border-border bg-background hover:bg-muted"
      )}
    >
      <Heart className={cn("size-4", saved && "fill-current")} />
      {!compact && label}
    </button>
  );
}
