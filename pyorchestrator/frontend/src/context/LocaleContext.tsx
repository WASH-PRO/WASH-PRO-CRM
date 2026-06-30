import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { en, type Messages } from "@/i18n/locales/en";
import { ru } from "@/i18n/locales/ru";

export type Locale = "en" | "ru";

const STORAGE_KEY = "pyorch-locale";

const catalogs: Record<Locale, Messages> = { en, ru };

interface LocaleCtx {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const LocaleContext = createContext<LocaleCtx | null>(null);

function readStoredLocale(): Locale {
  if (typeof window === "undefined") return "en";
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === "ru" ? "ru" : "en";
}

function lookup(messages: Messages, key: string): string | undefined {
  const value = key.split(".").reduce<unknown>((obj, part) => {
    if (obj && typeof obj === "object" && part in obj) {
      return (obj as Record<string, unknown>)[part];
    }
    return undefined;
  }, messages);
  return typeof value === "string" ? value : undefined;
}

function interpolate(text: string, vars?: Record<string, string | number>): string {
  if (!vars) return text;
  return Object.entries(vars).reduce(
    (result, [name, value]) => result.replaceAll(`{${name}}`, String(value)),
    text,
  );
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(readStoredLocale);

  useEffect(() => {
    document.documentElement.lang = locale;
    localStorage.setItem(STORAGE_KEY, locale);
  }, [locale]);

  const setLocale = (value: Locale) => setLocaleState(value);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      const text = lookup(catalogs[locale], key) ?? lookup(en, key) ?? key;
      return interpolate(text, vars);
    },
    [locale],
  );

  return <LocaleContext.Provider value={{ locale, setLocale, t }}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale outside LocaleProvider");
  return ctx;
}

export function useTranslation() {
  return useLocale();
}
