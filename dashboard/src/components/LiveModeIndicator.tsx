import { useLiveMode } from '../context/LiveModeContext';

function formatInterval(ms: number): string {
  if (ms < 1000) return `${ms} мс`;
  const sec = Math.round(ms / 1000);
  return sec === 1 ? '1 сек' : `${sec} сек`;
}

export function LiveModeIndicator() {
  const { live } = useLiveMode();
  if (!live) return null;

  const updated = live.lastUpdatedAt
    ? new Date(live.lastUpdatedAt).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '—';

  return (
    <div
      className="hidden items-center gap-2 rounded-lg border border-brand-500/20 bg-brand-500/5 px-3 py-1.5 text-xs text-brand-700 dark:border-brand-400/25 dark:bg-brand-400/10 dark:text-brand-300 md:flex"
      title="Данные обновляются автоматически"
    >
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-500" />
      </span>
      <span className="font-medium">Live</span>
      <span className="opacity-70">{formatInterval(live.intervalMs)}</span>
      <span className="hidden opacity-50 lg:inline">· {updated}</span>
    </div>
  );
}
