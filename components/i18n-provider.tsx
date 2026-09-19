"use client";

import React from "react";
import {
  dictionaries,
  locales,
  type Dictionary,
  type Locale,
} from "@/lib/i18n/dictionaries";

const STORAGE_KEY = "uniview-locale";
const DEFAULT_LOCALE: Locale = "en";

// Tiny external store: the chosen language lives in localStorage (with an
// in-memory fallback when storage is blocked) and components subscribe to it.
const listeners = new Set<() => void>();
let memoryLocale: Locale | null = null;

function isLocale(value: unknown): value is Locale {
  return locales.includes(value as Locale);
}

function subscribe(callback: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY) return;
    memoryLocale = null;
    callback();
  };
  listeners.add(callback);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): Locale {
  if (memoryLocale) return memoryLocale;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return isLocale(saved) ? saved : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

// The server always renders English; the saved language applies after hydration.
const getServerSnapshot = () => DEFAULT_LOCALE;

function setLocale(next: Locale) {
  memoryLocale = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {}
  listeners.forEach((l) => l());
}

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Dictionary;
};

const I18nContext = React.createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const locale = React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  React.useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const value = React.useMemo(
    () => ({ locale, setLocale, t: dictionaries[locale] }),
    [locale]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = React.useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}
