import { getActiveLocale } from '../i18n/LocaleContext';
import type { Locale } from '../i18n/types';
import { tGlobal } from '../i18n/runtime';

const RU_PLURAL = (n: number, one: string, few: string, many: string) => {
  const abs = Math.abs(n) % 100;
  const n1 = abs % 10;
  if (abs > 10 && abs < 20) return many;
  if (n1 > 1 && n1 < 5) return few;
  if (n1 === 1) return one;
  return many;
};

const EN_UNITS: { sec: number; one: string; many: string }[] = [
  { sec: 31536000, one: 'year', many: 'years' },
  { sec: 2592000, one: 'month', many: 'months' },
  { sec: 86400, one: 'day', many: 'days' },
  { sec: 3600, one: 'hour', many: 'hours' },
  { sec: 60, one: 'minute', many: 'minutes' },
  { sec: 1, one: 'second', many: 'seconds' },
];

const RU_UNITS: {
  sec: number;
  oneKey: string;
  fewKey: string;
  manyKey: string;
}[] = [
  { sec: 31536000, oneKey: 'format.duration.year.one', fewKey: 'format.duration.year.few', manyKey: 'format.duration.year.many' },
  { sec: 2592000, oneKey: 'format.duration.month.one', fewKey: 'format.duration.month.few', manyKey: 'format.duration.month.many' },
  { sec: 86400, oneKey: 'format.duration.day.one', fewKey: 'format.duration.day.few', manyKey: 'format.duration.day.many' },
  { sec: 3600, oneKey: 'format.duration.hour.one', fewKey: 'format.duration.hour.few', manyKey: 'format.duration.hour.many' },
  { sec: 60, oneKey: 'format.duration.minute.one', fewKey: 'format.duration.minute.few', manyKey: 'format.duration.minute.many' },
  { sec: 1, oneKey: 'format.duration.second.one', fewKey: 'format.duration.second.few', manyKey: 'format.duration.second.many' },
];

function localeTag(locale: Locale): string {
  return locale === 'ru' ? 'ru-RU' : 'en-US';
}

export function formatDurationHuman(totalSec?: number | null, locale: Locale = getActiveLocale()): string {
  if (totalSec == null || totalSec < 0) return '—';
  if (totalSec === 0) return locale === 'ru' ? tGlobal('format.duration.zeroRu') : tGlobal('format.duration.zeroEn');

  if (locale === 'ru') {
    for (const u of RU_UNITS) {
      if (totalSec >= u.sec) {
        const n = Math.floor(totalSec / u.sec);
        return `${n} ${RU_PLURAL(n, tGlobal(u.oneKey), tGlobal(u.fewKey), tGlobal(u.manyKey))}`;
      }
    }
    return `${totalSec} ${tGlobal('format.duration.second.many')}`;
  }

  for (const u of EN_UNITS) {
    if (totalSec >= u.sec) {
      const n = Math.floor(totalSec / u.sec);
      return `${n} ${n === 1 ? u.one : u.many}`;
    }
  }
  return `${totalSec} seconds`;
}

/** mm:ss pause formatter */
export function formatPause(sec?: number | null, locale: Locale = getActiveLocale()): string {
  if (sec == null) return '—';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  const delimiter = locale === 'ru' ? ':' : ':';
  return `${m}${delimiter}${String(s).padStart(2, '0')}`;
}

export function formatDateTime(value?: string | null, locale: Locale = getActiveLocale()): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString(localeTag(locale));
}

export interface CurrencyConfig {
  code: string;
  name?: string;
  symbol?: string;
}

export function formatMoney(
  amount: number | undefined | null,
  currency: CurrencyConfig = { code: 'RUB', symbol: '₽' },
  locale: Locale = getActiveLocale()
): string {
  const value = amount ?? 0;
  const symbol = currency.symbol || currency.code;
  return `${value.toLocaleString(localeTag(locale), { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${symbol}`;
}

export function deriveLogLevel(entry: { action: string; statusCode?: number }): string {
  if (entry.action === 'error') return 'Error';
  if (entry.statusCode && entry.statusCode >= 500) return 'Critical';
  if (entry.statusCode && entry.statusCode >= 400) return 'Warning';
  if (entry.action === 'api_call') return 'Info';
  return 'Debug';
}
