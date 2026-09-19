"use client";

import {
  CalendarDays,
  FolderTree,
  Gauge,
  Link2,
  Search,
  ShieldCheck,
  Type,
  UserSquare,
} from "lucide-react";
import { useI18n } from "@/components/i18n-provider";

const stepIcons = [Type, Search, ShieldCheck, FolderTree, UserSquare];
const honestyIcons = [Link2, CalendarDays, Gauge];

export function HowItWorks() {
  const { t } = useI18n();

  return (
    <section id="how-it-works" className="scroll-mt-20 border-t border-border py-20">
      <div className="mx-auto max-w-6xl px-4">
        <h2 className="text-3xl font-semibold tracking-tight">{t.steps.title}</h2>
        <p className="mt-2 text-muted-foreground">{t.steps.subtitle}</p>
        <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {t.steps.items.map((step, i) => {
            const Icon = stepIcons[i];
            return (
              <li key={step.title} className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <span className="flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    {i + 1}
                  </span>
                  <Icon className="size-4" />
                </div>
                <h3 className="mt-4 font-semibold">{step.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{step.text}</p>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

export function Honesty() {
  const { t } = useI18n();

  return (
    <section id="honesty" className="scroll-mt-20 border-t border-border py-20">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 md:grid-cols-2">
        <div className="border-l-4 border-emerald-600 pl-5">
          <h2 className="text-3xl font-semibold tracking-tight">{t.honesty.title}</h2>
          <p className="mt-3 text-muted-foreground">{t.honesty.text}</p>
        </div>
        <ul className="grid gap-3">
          {t.honesty.points.map((point, i) => {
            const Icon = honestyIcons[i];
            return (
              <li
                key={point}
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-4"
              >
                <Icon className="size-5 text-emerald-600" />
                <span className="text-sm">{point}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

export function SiteFooter() {
  const { t } = useI18n();
  return (
    <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground print:hidden">
      {t.footer}
    </footer>
  );
}
