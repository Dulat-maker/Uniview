"use client";

import Link from "next/link";
import { GraduationCap, Heart, Languages } from "lucide-react";
import { usePersonal } from "@/lib/personal-store";
import { useI18n } from "@/components/i18n-provider";
import { locales } from "@/lib/i18n/dictionaries";
import { cn } from "@/lib/utils";

export function SiteHeader() {
  const { t, locale, setLocale } = useI18n();
  const savedCount = Object.keys(usePersonal().saved).length;

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur print:hidden">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <GraduationCap className="size-5" />
          {t.brand}
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/saved" className="flex items-center gap-1 text-muted-foreground hover:text-foreground">
            <Heart className="size-4" />
            <span className="hidden sm:inline">{t.nav.saved}</span>
            {savedCount > 0 && <span className="tabular-nums">({savedCount})</span>}
          </Link>
          <Link href="/compare" className="text-muted-foreground hover:text-foreground">
            {t.nav.compare}
          </Link>
          <Link
            href="/#how-it-works"
            className="hidden text-muted-foreground hover:text-foreground sm:inline"
          >
            {t.nav.howItWorks}
          </Link>
          <Link
            href="/#honesty"
            className="hidden text-muted-foreground hover:text-foreground sm:inline"
          >
            {t.nav.honesty}
          </Link>
          <div className="flex items-center gap-1 rounded-lg border border-border p-0.5">
            <Languages className="mx-1 size-4 text-muted-foreground" />
            {locales.map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLocale(l)}
                aria-pressed={locale === l}
                className={cn(
                  "rounded-md px-2 py-0.5 text-xs font-medium uppercase transition-colors",
                  locale === l
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {l}
              </button>
            ))}
          </div>
        </nav>
      </div>
    </header>
  );
}
