import { en } from './messages/en';
import { ru } from './messages/ru';
import type { Locale } from './types';

export const catalogs = { en, ru } as const;

export function isLocale(value: unknown): value is Locale {
  return value === 'en' || value === 'ru';
}
