import clsx from 'clsx';
import { Pause, Radio } from 'lucide-react';
import { useLiveMode } from '../context/LiveModeContext';
import { useLocale } from '../i18n/LocaleContext';

export function LiveModeIndicator() {
  const { liveEnabled, setLiveEnabled } = useLiveMode();
  const { t } = useLocale();

  return (
    <button
      type="button"
      onClick={() => setLiveEnabled(!liveEnabled)}
      className={clsx(
        'btn-icon',
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
  );
}
