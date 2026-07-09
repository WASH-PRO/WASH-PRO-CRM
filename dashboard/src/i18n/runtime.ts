import { getActiveLocale } from './LocaleContext';
import { catalogs } from './catalogs';
import { translate } from './translate';

export type TranslateParams = Record<string, string | number>;

export function tGlobal(key: string, params?: TranslateParams): string {
  const locale = getActiveLocale();
  return translate(catalogs[locale], key, params);
}
