import { useEffect, useState } from 'react';
import { formatPause } from '../utils/format';
import { useLocale } from '../i18n/LocaleContext';

interface Props {
  /** Базовое время режима в секундах на момент последнего обновления API */
  baseSeconds?: number | null;
  /** Момент последнего обновления данных */
  fetchedAt?: number;
  waiting?: boolean;
}

/** Таймер режима — тикает каждую секунду поверх последнего значения API */
export function LiveModeTimer({ baseSeconds, fetchedAt, waiting }: Props) {
  const { t } = useLocale();
  const [display, setDisplay] = useState('—');

  useEffect(() => {
    if (waiting) {
      setDisplay(t('liveModeTimer.waiting'));
      return;
    }
    if (baseSeconds == null || fetchedAt == null) {
      setDisplay(t('liveModeTimer.waiting'));
      return;
    }

    const tick = () => {
      const elapsed = baseSeconds + Math.floor((Date.now() - fetchedAt) / 1000);
      setDisplay(formatPause(elapsed));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [baseSeconds, fetchedAt, waiting, t]);

  return <span className="font-mono tabular-nums">{display}</span>;
}
