import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Locale } from './types';
import { translate } from './translate';
import { catalogs, isLocale } from './catalogs';

const STORAGE_KEY = 'wash_locale';
const DEFAULT_LOCALE: Locale = 'en';

/** Synced with LocaleProvider state for non-React callers (format, api). */
let runtimeLocale: Locale = DEFAULT_LOCALE;

type TParams = Record<string, string | number>;

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: TParams) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

function readStoredLocale(): Locale {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (isLocale(raw)) return raw;
  } catch {
    /* ignore */
  }
  return DEFAULT_LOCALE;
}

runtimeLocale = readStoredLocale();

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const stored = readStoredLocale();
    runtimeLocale = stored;
    return stored;
  });

  useEffect(() => {
    runtimeLocale = locale;
    document.documentElement.lang = locale;
    try {
      localStorage.setItem(STORAGE_KEY, locale);
    } catch {
      /* ignore */
    }
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    runtimeLocale = next;
    setLocaleState(next);
  }, []);

  const t = useCallback(
    (key: string, params?: TParams) => translate(catalogs[locale], key, params),
    [locale]
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale must be used within LocaleProvider');
  return ctx;
}

export function useT() {
  return useLocale().t;
}

export function getActiveLocale(): Locale {
  return runtimeLocale;
}
