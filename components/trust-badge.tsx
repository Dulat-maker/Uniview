"use client";

import { ShieldAlert, ShieldCheck, ShieldQuestion } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { cn } from "@/lib/utils";

export type TrustLevel = "high" | "medium" | "low";

const styles: Record<TrustLevel, { className: string; Icon: typeof ShieldCheck }> = {
  high: { className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400", Icon: ShieldCheck },
  medium: { className: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400", Icon: ShieldQuestion },
  low: { className: "border-zinc-500/40 bg-zinc-500/10 text-zinc-700 dark:text-zinc-300", Icon: ShieldAlert },
};

/** Confidence + source label for a non-photo item (description, distance, climate…). */
export function TrustBadge({
  level,
  source,
  hint,
  className,
}: {
  level: TrustLevel;
  source: string;
  hint: string;
  className?: string;
}) {
  const { t } = useI18n();
  const { className: tone, Icon } = styles[level];
  return (
    <span
      title={hint}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        tone,
        className
      )}
    >
      <Icon className="size-3.5" />
      {t.trust[level]} · {t.trust.source(source)}
    </span>
  );
}
