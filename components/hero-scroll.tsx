"use client";

import { Sparkles } from "lucide-react";
import { ContainerScroll } from "@/components/ui/container-scroll-animation";
import { ProfilePreview } from "@/components/profile-preview";
import { SearchBox } from "@/components/search-box";
import { useI18n } from "@/components/i18n-provider";

export function HeroScroll() {
  const { t } = useI18n();

  return (
    <div className="flex flex-col overflow-hidden pb-20 md:pb-40">
      <ContainerScroll
        titleComponent={
          // Bottom padding keeps the search bar clear of the tilted card (-mt-12).
          <div className="flex flex-col items-center gap-5 px-4 pb-20 md:pb-24">
            <span className="flex items-center gap-1.5 rounded-full border border-border bg-muted/60 px-3 py-1 text-xs font-medium text-muted-foreground">
              <Sparkles className="size-3.5" />
              {t.hero.eyebrow}
            </span>
            <h1 className="text-3xl font-semibold text-black md:text-4xl dark:text-white">
              {t.hero.titleTop} <br />
              <span className="mt-1 block text-4xl font-bold leading-none md:text-[5.5rem]">
                {t.hero.titleBottom}
              </span>
            </h1>
            <p className="max-w-2xl text-sm text-muted-foreground md:text-lg">
              {t.hero.subtitle}
            </p>
            <SearchBox />
          </div>
        }
      >
        <ProfilePreview />
      </ContainerScroll>
    </div>
  );
}
