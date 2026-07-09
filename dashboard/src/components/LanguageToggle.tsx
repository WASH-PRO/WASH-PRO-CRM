import clsx from 'clsx';
import { useLocale } from '../i18n/LocaleContext';
import type { Locale } from '../i18n/types';

const ORDER: Locale[] = ['en', 'ru'];

const LOCALE_FLAGS: Record<Locale, string> = {
  en: '🇺🇸',
  ru: '🇷🇺',
};

export function LanguageToggle({ className, showLabel = false }: { className?: string; showLabel?: boolean }) {
  const { locale, setLocale, t } = useLocale();

  const cycle = () => {
    const idx = ORDER.indexOf(locale);
    setLocale(ORDER[(idx + 1) % ORDER.length]!);
  };

  return (
    <button
      type="button"
      onClick={cycle}
      className={className ?? 'btn-icon !w-auto gap-0.5 px-1.5'}
      title={t('language.switchTitle', { lang: t(`language.names.${locale}`) })}
      aria-label={t('language.switchTitle', { lang: t(`language.names.${locale}`) })}
    >
      {ORDER.map((code) => (
        <span
          key={code}
          className={clsx(
            'text-base leading-none transition-opacity',
            locale === code ? 'opacity-100' : 'opacity-35'
          )}
          aria-hidden
        >
          {LOCALE_FLAGS[code]}
        </span>
      ))}
      {showLabel && (
        <span className={clsx('ml-1 text-xs font-medium uppercase')}>{locale}</span>
      )}
    </button>
  );
}

export function LanguageSelect({ className }: { className?: string }) {
  const { locale, setLocale, t } = useLocale();

  return (
    <div className={className}>
      <label className="label" htmlFor="crm-locale-select">
        {t('language.label')}
      </label>
      <select
        id="crm-locale-select"
        className="input max-w-xs"
        value={locale}
        onChange={(e) => setLocale(e.target.value as Locale)}
      >
        {ORDER.map((code) => (
          <option key={code} value={code}>
            {t(`language.names.${code}`)}
          </option>
        ))}
      </select>
      <p className="field-hint mt-1">{t('language.hint')}</p>
    </div>
  );
}
