import { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import clsx from 'clsx';
import type { LucideIcon } from 'lucide-react';
import { resolveRouteIcon } from '../utils/navRoutes';
export { CARD_STATUS_LABELS as cardStatusLabel } from '../utils/cards';

export function PageHeader({
  title,
  subtitle,
  actions,
  icon,
  showRouteIcon = true,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  icon?: LucideIcon;
  showRouteIcon?: boolean;
}) {
  const { pathname } = useLocation();
  const RouteIcon = icon ?? (showRouteIcon ? resolveRouteIcon(pathname) : null);

  return (
    <header className="page-header mb-5 flex flex-col gap-3 border-b border-panel-border pb-4 dark:border-panel-border-dark sm:mb-7 sm:gap-4 sm:pb-5 md:flex-row md:items-start md:justify-between">
      <div className="flex min-w-0 flex-1 items-start gap-4 sm:items-stretch sm:gap-6 md:gap-7">
        {RouteIcon && (
          <div className="hidden shrink-0 sm:flex sm:items-stretch" aria-hidden>
            <div className="flex aspect-square h-full min-h-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-brand-500/10 dark:bg-brand-400/10 dark:text-brand-400 dark:ring-brand-400/20 sm:min-h-12">
              <RouteIcon className="h-7 w-7 sm:h-8 sm:w-8" strokeWidth={1.75} />
            </div>
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-xl font-semibold tracking-tight text-panel-ink dark:text-panel-ink-dark sm:text-2xl lg:text-[1.75rem] lg:leading-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-panel-muted dark:text-panel-muted-dark sm:line-clamp-3 md:line-clamp-none">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 md:pt-0.5">{actions}</div>
      )}
    </header>
  );
}

export function StatCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="panel-stat">
      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-panel-muted dark:text-panel-muted-dark">
        {label}
      </div>
      <div className="mt-2 font-display text-2xl font-semibold tracking-tight text-panel-ink tabular-nums dark:text-panel-ink-dark sm:text-[1.65rem]">
        {value}
      </div>
      {hint && <div className="field-hint mt-2">{hint}</div>}
    </div>
  );
}

export function Badge({
  children,
  variant = 'default',
  className,
}: {
  children: ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'error';
  className?: string;
}) {
  const colors = {
    default: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    success: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/10 dark:bg-emerald-500/10 dark:text-emerald-300',
    warning: 'bg-amber-50 text-amber-800 ring-1 ring-amber-600/10 dark:bg-amber-500/10 dark:text-amber-300',
    error: 'bg-red-50 text-red-700 ring-1 ring-red-600/10 dark:bg-red-500/10 dark:text-red-300',
  };
  return (
    <span className={clsx('inline-flex rounded-md px-2 py-0.5 text-xs font-medium', colors[variant], className)}>
      {children}
    </span>
  );
}

export function Loading({ fullScreen = false }: { fullScreen?: boolean }) {
  return (
    <div
      className={clsx(
        'flex flex-col items-center justify-center gap-3',
        fullScreen ? 'min-h-screen bg-panel-canvas dark:bg-panel-canvas-dark' : 'py-28'
      )}
    >
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      <span className="text-sm text-panel-muted dark:text-panel-muted-dark">Загрузка…</span>
    </div>
  );
}

export function Empty({ message = 'Нет данных' }: { message?: string }) {
  return (
    <div className="py-16 text-center text-sm text-panel-muted dark:text-panel-muted-dark">{message}</div>
  );
}

export function ErrorMessage({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
      {message}
    </div>
  );
}

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="table-shell overflow-x-auto">
      <table className="w-full text-left text-sm">{children}</table>
    </div>
  );
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="flex max-h-[min(92vh,100dvh)] w-full max-w-lg flex-col rounded-t-panel border border-panel-border bg-panel-card shadow-panel-lg dark:border-panel-border-dark dark:bg-panel-card-dark sm:max-h-[min(90vh,100dvh)] sm:rounded-panel">
        <div className="flex shrink-0 items-center justify-between border-b border-panel-border px-4 py-4 dark:border-panel-border-dark sm:px-6">
          <h2 className="pr-4 text-lg font-semibold tracking-tight">{title}</h2>
          <button type="button" onClick={onClose} className="btn-ghost !px-2 !py-1 text-lg leading-none">
            ×
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">{children}</div>
      </div>
    </div>
  );
}

export const statusLabel: Record<string, string> = {
  online: 'Онлайн',
  offline: 'Офлайн',
  error: 'Ошибка',
  maintenance: 'Обслуживание',
  in_progress: 'В процессе',
  completed: 'Завершено',
  failed: 'Ошибка',
};

export const periodLabel: Record<string, string> = {
  before_collection: 'До инкассации',
  after_collection: 'После инкассации',
};

export const categoryLabel: Record<string, string> = {
  regular: 'Скидочные клиенты',
  unlimited: 'VIP-обслуживание',
  service: 'Сервисное обслуживание',
};

export const cardTypeLabel: Record<string, string> = {
  regular: 'Скидочная',
  unlimited: 'VIP',
  service: 'Сервисная',
};

export const logCategoryOptions = [
  { value: '', label: 'Все категории' },
  { value: 'api_call', label: 'API запросы' },
  { value: 'error', label: 'API ответы / ошибки' },
  { value: 'webhook_dispatch', label: 'Сетевые события' },
  { value: 'cron_run', label: 'Фоновые задачи' },
  { value: 'mcp_call', label: 'Внутренние системные' },
  { value: 'login', label: 'Авторизация' },
];

export const logLevelOptions = [
  { value: '', label: 'Все уровни' },
  { value: 'Debug', label: 'Debug' },
  { value: 'Info', label: 'Info' },
  { value: 'Warning', label: 'Warning' },
  { value: 'Error', label: 'Error' },
  { value: 'Critical', label: 'Critical' },
];
