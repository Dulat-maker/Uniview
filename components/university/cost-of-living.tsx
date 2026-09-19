"use client";

import React from "react";
import { BedDouble, ExternalLink, Wallet } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { Rich } from "@/components/rich-text";
import { TrustBadge } from "@/components/trust-badge";
import { BASKET_US_TOTAL, countryName, formatMoney, homeFactor, studentBudget } from "@/lib/cost";
import { personal, usePersonal } from "@/lib/personal-store";
import type { CountryPrice, UniversityProfile } from "@/lib/types";

/** All countries' price levels, loaded once per visit for the "compare with your country" picker. */
let pricesPromise: Promise<CountryPrice[]> | undefined;
function loadPrices() {
  pricesPromise ??= fetch("/api/prices")
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then((d: { countries: CountryPrice[] }) => d.countries)
    .catch((e) => {
      pricesPromise = undefined;
      throw e;
    });
  return pricesPromise;
}

export function usePriceTable() {
  const [countries, setCountries] = React.useState<CountryPrice[]>();
  React.useEffect(() => {
    let alive = true;
    loadPrices()
      .then((c) => alive && setCountries(c))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return countries;
}

export function CostOfLiving({ profile }: { profile: UniversityProfile }) {
  const { t, locale } = useI18n();
  const c = t.profile.cost;
  const price = profile.facts.priceLevel;
  const data = usePersonal();
  const countries = usePriceTable();

  const sortedCountries = React.useMemo(
    () =>
      (countries ?? [])
        .map((x) => ({ iso2: x.iso2, name: countryName(x.iso2, x.name, locale) }))
        .sort((a, b) => a.name.localeCompare(b.name, locale)),
    [countries, locale]
  );

  const host = profile.website ? new URL(profile.website).hostname.replace(/^www\./, "") : undefined;
  const housingSearch = `https://www.google.com/search?q=${encodeURIComponent(
    host ? `site:${host} ${c.housingQuery}` : `"${profile.label}" ${c.housingQuery}`
  )}`;

  if (!price) {
    return (
      <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-5 text-sm">
        <h3 className="flex items-center gap-2 font-semibold">
          <Wallet className="size-5 text-muted-foreground" />
          {c.title}
        </h3>
        <p className="text-muted-foreground">{c.noData}</p>
      </div>
    );
  }

  const budget = studentBudget(price);
  const usd = (v: number) => formatMoney(v, "USD", locale);
  const local = (v: number) => (budget.local ? formatMoney(v * budget.local.rate, budget.local.currency, locale) : undefined);
  const country = price.iso2 ? countryName(price.iso2, price.country, locale) : price.country;
  const pct = Math.round(price.ratio * 100);
  const cheaperShare = price.cheaperThanShare !== undefined ? Math.round(price.cheaperThanShare * 100) : undefined;

  const homeIso = data.homeCountry;
  const home = homeIso && homeIso !== price.iso2 ? countries?.find((x) => x.iso2 === homeIso) : undefined;
  const factor = home ? homeFactor(price.ratio, home) : undefined;
  const homeName = home ? countryName(home.iso2, home.name, locale) : "";
  const fmtFactor = (x: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(x);

  return (
    <div className="flex flex-col gap-5 rounded-xl border border-border bg-card p-5 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-semibold">
          <Wallet className="size-5 text-muted-foreground" />
          {c.title}
        </h3>
        <TrustBadge level="low" source="World Bank" hint={t.trust.hints.cost} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: the monthly estimate and what it is made of. */}
        <div className="flex flex-col gap-3">
          <div>
            <p className="text-muted-foreground">{c.estimateLabel}</p>
            <p className="text-3xl font-semibold tracking-tight">
              ≈ {usd(budget.total)}
              <span className="text-base font-normal text-muted-foreground"> {c.perMonth}</span>
            </p>
            {budget.local && (
              <p className="text-lg font-medium">
                ≈ {local(budget.total)}
                <span className="text-sm font-normal text-muted-foreground"> {c.perMonth}</span>
              </p>
            )}
          </div>
          <p>
            <Rich text={c.lead} />
          </p>
          <p>
            <Rich text={c.range(usd(budget.low), usd(budget.high))} />
          </p>

          <table className="w-full text-left tabular-nums">
            <caption className="mb-1 text-left font-medium">{c.basketTitle}</caption>
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th className="py-1 font-normal" />
                <th className="py-1 text-right font-normal">{c.usCol}</th>
                <th className="py-1 text-right font-normal">{c.hereCol}</th>
              </tr>
            </thead>
            <tbody>
              {budget.items.map((i) => (
                <tr key={i.key} className="border-t border-border">
                  <td className="py-1.5 pr-2">{c.basket[i.key]}</td>
                  <td className="py-1.5 text-right text-muted-foreground">{usd(i.us)}</td>
                  <td className="py-1.5 pl-2 text-right font-medium">
                    {usd(i.here)}
                    {budget.local && <span className="block text-xs font-normal text-muted-foreground">{local(i.here)}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {budget.local && (
            <p className="text-xs text-muted-foreground">
              {c.rate(new Intl.NumberFormat(locale, { maximumSignificantDigits: 4 }).format(budget.local.rate), budget.local.currency, price.year)}
            </p>
          )}
        </div>

        {/* Right: context that helps to decide. */}
        <div className="flex flex-col gap-4">
          <p>
            <Rich text={c.level(country, String(pct))} />
            {cheaperShare !== undefined && (
              <>
                {" "}
                <Rich text={cheaperShare >= 50 ? c.cheaperThan(String(cheaperShare)) : c.pricierThan(String(100 - cheaperShare))} />
              </>
            )}
          </p>

          <div className="flex flex-col gap-2 rounded-lg bg-muted/60 p-3">
            <label htmlFor="home-country" className="font-medium">
              {c.homeTitle}
            </label>
            <select
              id="home-country"
              value={homeIso ?? ""}
              onChange={(e) => personal.setHomeCountry(e.target.value || undefined)}
              disabled={!countries}
              className="h-9 rounded-lg border border-border bg-background px-2"
            >
              <option value="">{countries ? c.homePlaceholder : c.homeLoading}</option>
              {sortedCountries.map((x) => (
                <option key={x.iso2} value={x.iso2}>
                  {x.name}
                </option>
              ))}
            </select>
            {homeIso === price.iso2 && <p>{c.homeSameCountry}</p>}
            {home && factor !== undefined && (
              <>
                <p>
                  <Rich
                    text={
                      factor >= 1.1
                        ? c.homeCheaper(homeName, fmtFactor(factor))
                        : factor <= 1 / 1.1
                          ? c.homePricier(homeName, fmtFactor(1 / factor))
                          : c.homeSame(homeName)
                    }
                  />
                </p>
                <p className="text-muted-foreground">
                  {c.homeBudget(homeName, usd(BASKET_US_TOTAL * home.ratio))}
                </p>
              </>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <p className="flex items-center gap-2 font-medium">
              <BedDouble className="size-4 text-muted-foreground" />
              {c.rentTitle}
            </p>
            <p>
              <Rich text={c.rentText} />
            </p>
            <a
              href={housingSearch}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-medium underline-offset-4 hover:underline"
            >
              {c.rentLink}
              <ExternalLink className="size-3.5" />
            </a>
          </div>

          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
            {c.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">{c.method(usd(BASKET_US_TOTAL), price.year)}</p>
    </div>
  );
}
