import clsx from 'clsx';
import { POST_ONLINE_THRESHOLD_MS } from '../constants/live';
import { isPostOnline } from '../utils/statsAggregation';

interface PostOnlineState {
  lastMessageAt?: string;
  createdAt?: string;
}

interface PostOnlineStatusProps {
  state?: PostOnlineState;
  showLabel?: boolean;
  className?: string;
}

function statusDot(online: boolean): string {
  return online
    ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.55)]'
    : 'bg-slate-400 dark:bg-slate-600';
}

export function PostOnlineStatus({ state, showLabel = true, className }: PostOnlineStatusProps) {
  const online = isPostOnline(state);
  const label = online ? 'Онлайн' : 'Офлайн';
  const hint = online
    ? `Телеметрия за последние ${POST_ONLINE_THRESHOLD_MS / 1000} с`
    : 'Нет телеметрии или данные устарели';

  return (
    <span
      className={clsx('inline-flex items-center gap-1.5', className)}
      title={hint}
    >
      <span className={clsx('h-2 w-2 shrink-0 rounded-full', statusDot(online))} aria-hidden />
      {showLabel && (
        <span
          className={clsx(
            'text-xs font-medium',
            online ? 'text-emerald-700 dark:text-emerald-400' : 'text-panel-muted dark:text-panel-muted-dark'
          )}
        >
          {label}
        </span>
      )}
    </span>
  );
}
