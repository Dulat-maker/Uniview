"use client";

import { BadgeCheck, CircleAlert, CircleHelp } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import type { PhotoStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const statusStyles: Record<PhotoStatus, { className: string; Icon: typeof BadgeCheck }> = {
  verified: { className: "bg-emerald-500/90 text-white", Icon: BadgeCheck },
  likely: { className: "bg-amber-400/95 text-amber-950", Icon: CircleHelp },
  unverified: { className: "bg-zinc-700/90 text-white", Icon: CircleAlert },
};

export function StatusBadge({
  status,
  confidence,
  className,
}: {
  status: PhotoStatus;
  confidence: number;
  className?: string;
}) {
  const { t } = useI18n();
  const { className: tone, Icon } = statusStyles[status];
  return (
    <span
      className={cn(
        "flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium md:text-xs",
        tone,
        className
      )}
    >
      <Icon className="size-3" />
      {t.status[status]} · {Math.round(confidence * 100)}%
    </span>
  );
}
