"use client";

import { Warp, type WarpProps } from "@paper-design/shaders-react";
import { BedDouble, Check, FlaskConical, PartyPopper, Trophy, type LucideIcon } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import type { PhotoTag } from "@/lib/types";
import { cn } from "@/lib/utils";

// Shader looks adapted from components/ui/feature-shader-cards.tsx, one colour family per filter.
const filterCards: Record<PhotoTag, { Icon: LucideIcon; shader: Partial<WarpProps> }> = {
  athletics: {
    Icon: Trophy,
    shader: {
      proportion: 0.45, softness: 1.1, distortion: 0.22, swirl: 0.8, swirlIterations: 15,
      shape: "stripes", shapeScale: 0.09,
      colors: ["hsl(30, 100%, 35%)", "hsl(50, 100%, 65%)", "hsl(40, 90%, 40%)", "hsl(45, 100%, 75%)"],
    },
  },
  dormitory: {
    Icon: BedDouble,
    shader: {
      proportion: 0.38, softness: 0.95, distortion: 0.16, swirl: 0.85, swirlIterations: 11,
      shape: "checks", shapeScale: 0.11,
      colors: ["hsl(250, 100%, 30%)", "hsl(270, 100%, 65%)", "hsl(260, 90%, 35%)", "hsl(265, 100%, 70%)"],
    },
  },
  labs: {
    Icon: FlaskConical,
    shader: {
      proportion: 0.4, softness: 1.2, distortion: 0.2, swirl: 0.9, swirlIterations: 12,
      shape: "stripes", shapeScale: 0.12,
      colors: ["hsl(200, 100%, 25%)", "hsl(180, 100%, 65%)", "hsl(160, 90%, 35%)", "hsl(190, 100%, 75%)"],
    },
  },
  studentLife: {
    Icon: PartyPopper,
    shader: {
      proportion: 0.42, softness: 1.0, distortion: 0.19, swirl: 0.75, swirlIterations: 9,
      shape: "checks", shapeScale: 0.13,
      colors: ["hsl(330, 100%, 30%)", "hsl(350, 100%, 60%)", "hsl(340, 90%, 35%)", "hsl(345, 100%, 75%)"],
    },
  },
};

export function FilterCards({
  counts,
  selected,
  onToggle,
}: {
  counts: Record<PhotoTag, number>;
  selected: PhotoTag[];
  onToggle: (tag: PhotoTag) => void;
}) {
  const { t } = useI18n();

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {(Object.keys(filterCards) as PhotoTag[]).map((tag) => {
        const { Icon, shader } = filterCards[tag];
        const isSelected = selected.includes(tag);
        const count = counts[tag];
        return (
          <button
            key={tag}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onToggle(tag)}
            className={cn(
              "relative h-40 rounded-3xl text-left outline-none transition-transform focus-visible:ring-3 focus-visible:ring-ring active:scale-[0.98] md:h-44",
              isSelected && "ring-3 ring-foreground ring-offset-2 ring-offset-background"
            )}
          >
            <div className="absolute inset-0 overflow-hidden rounded-3xl">
              <Warp
                style={{ height: "100%", width: "100%" }}
                {...shader}
                scale={1}
                rotation={0}
                speed={isSelected ? 0.8 : 0.2}
              />
            </div>
            <div
              className={cn(
                "relative z-10 flex h-full flex-col rounded-3xl border border-white/20 p-4 transition-colors md:p-5 dark:border-white/10",
                isSelected ? "bg-black/45" : "bg-black/80"
              )}
            >
              <div className="flex items-start justify-between">
                <Icon className="size-7 text-white drop-shadow-lg md:size-8" />
                {isSelected && (
                  <span className="flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-black">
                    <Check className="size-3" />
                    {t.profile.selected}
                  </span>
                )}
              </div>
              <h3 className="mt-2 text-base font-bold text-white md:text-lg">{t.filters[tag]}</h3>
              <p className="line-clamp-2 text-xs font-medium text-gray-200">{t.filterHints[tag]}</p>
              <p className="mt-auto text-sm font-bold text-gray-100">
                {count > 0 ? t.profile.photoCount(count) : t.profile.noneFound}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
