import clsx from 'clsx';
import { Pause, Radio } from 'lucide-react';
import { useLiveMode } from '../context/LiveModeContext';

export function LiveModeIndicator() {
  const { liveEnabled, setLiveEnabled } = useLiveMode();

  return (
    <div
      className="flex items-center rounded-lg border border-panel-border bg-panel-surface p-0.5 text-xs dark:border-panel-border-dark dark:bg-panel-bg-dark"
      role="group"
      aria-label="Режим обновления данных"
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
        title="Автообновление данных"
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
        title="Данные не обновляются автоматически"
        aria-pressed={!liveEnabled}
      >
        <Pause size={14} strokeWidth={2} className="opacity-70" />
        <span className="hidden sm:inline">Статика</span>
      </button>
    </div>
  );
}
