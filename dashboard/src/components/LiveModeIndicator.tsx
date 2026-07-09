import clsx from 'clsx';
import { Pause, Radio } from 'lucide-react';
import { useLiveMode } from '../context/LiveModeContext';
import { useLocale } from '../i18n/LocaleContext';

export function LiveModeIndicator() {
  const { liveEnabled, setLiveEnabled } = useLiveMode();
  const { t } = useLocale();

  return (
    <>
      <button
        type="button"
        onClick={() => setLiveEnabled(!liveEnabled)}
        className={clsx(
          'btn-icon sm:hidden',
          liveEnabled && 'border-brand-500/30 text-brand-600 dark:text-brand-400'
        )}
        title={liveEnabled ? t('liveModeIndicator.liveTitle') : t('liveModeIndicator.staticTitle')}
        aria-label={t('liveModeIndicator.groupLabel')}
        aria-pressed={liveEnabled}
      >
        {liveEnabled ? (
          <span className="relative flex h-[18px] w-[18px] items-center justify-center">
            <span className="absolute inline-flex h-2.5 w-2.5 animate-ping rounded-full bg-brand-400 opacity-60" />
            <Radio size={18} strokeWidth={2} />
          </span>
        ) : (
          <Pause size={18} strokeWidth={2} />
        )}
      </button>

      <div
        className="hidden items-center rounded-lg border border-panel-border bg-panel-surface p-0.5 text-xs sm:flex dark:border-panel-border-dark dark:bg-panel-bg-dark"
        role="group"
        aria-label={t('liveModeIndicator.groupLabel')}
      >
        <button
          type="button"
          onClick={() => setLiveEnabled(true)}
          className={clsx(
            'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-medium transition-colors',
            liveEnabled
              ? 'bg-brand-500/15 text-brand-700 dark:bg-brand-400/20 dark:text-brand-300'
              : 'text-panel-muted hover:text-panel-ink dark:hover:text-panel-ink-dark'
          )}
          title={t('liveModeIndicator.liveTitle')}
          aria-pressed={liveEnabled}
        >
          {liveEnabled && (
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-500" />
            </span>
          )}
          {!liveEnabled && <Radio size={14} strokeWidth={2} className="opacity-70" />}
          <span>Live</span>
        </button>
        <button
          type="button"
          onClick={() => setLiveEnabled(false)}
          className={clsx(
            'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-medium transition-colors',
            !liveEnabled
              ? 'bg-panel-canvas text-panel-ink dark:bg-white/10 dark:text-panel-ink-dark'
              : 'text-panel-muted hover:text-panel-ink dark:hover:text-panel-ink-dark'
          )}
          title={t('liveModeIndicator.staticTitle')}
          aria-pressed={!liveEnabled}
        >
          <Pause size={14} strokeWidth={2} className="opacity-70" />
          <span>{t('live.static')}</span>
        </button>
      </div>
    </>
  );
}
