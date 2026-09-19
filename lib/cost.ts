// Student budget estimate: a modest monthly basket at US prices, scaled by the country's
// everyday price level (World Bank). Rent is left out on purpose: there is no open data for it.
import type { CityFacts, CountryPrice } from "@/lib/types";

export const BASKET = [
  { key: "groceries", usd: 350 },
  { key: "eatingOut", usd: 100 },
  { key: "transport", usd: 60 },
  { key: "phone", usd: 50 },
  { key: "personal", usd: 100 },
] as const;

export type BasketKey = (typeof BASKET)[number]["key"];
export const BASKET_US_TOTAL = BASKET.reduce((sum, i) => sum + i.usd, 0);

/** ±20%: habits differ more than the price level does. */
const SPREAD = 0.2;

export function studentBudget(price: NonNullable<CityFacts["priceLevel"]>) {
  const total = BASKET_US_TOTAL * price.ratio;
  return {
    total,
    low: total * (1 - SPREAD),
    high: total * (1 + SPREAD),
    items: BASKET.map((i) => ({ key: i.key as BasketKey, us: i.usd, here: i.usd * price.ratio })),
    // A second line in dollars would only repeat the first one.
    local: price.lcuPerUsd && price.currency && price.currency !== "USD" ? { rate: price.lcuPerUsd, currency: price.currency } : undefined,
  };
}

/** Round to 2 significant digits, since it is an estimate: 237 → 240, 123 456 → 120 000. */
export function roundNice(value: number) {
  if (value <= 0) return 0;
  const step = 10 ** Math.max(0, Math.floor(Math.log10(value)) - 1);
  return Math.round(value / step) * step;
}

export function formatMoney(value: number, currency: string, locale: string) {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      currencyDisplay: currency === "USD" ? "symbol" : "narrowSymbol",
      maximumFractionDigits: 0,
    }).format(roundNice(value));
  } catch {
    return `${new Intl.NumberFormat(locale).format(roundNice(value))} ${currency}`;
  }
}

/** How many times cheaper (>1) or pricier (<1) the university's country is than `home`. */
export function homeFactor(uniRatio: number, home: CountryPrice) {
  return home.ratio / uniRatio;
}

export function countryName(iso2: string, fallback: string, locale: string) {
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(iso2) ?? fallback;
  } catch {
    return fallback;
  }
}
