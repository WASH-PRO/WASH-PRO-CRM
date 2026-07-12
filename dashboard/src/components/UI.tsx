import { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import clsx from 'clsx';
import type { LucideIcon } from 'lucide-react';
import { resolveRouteIcon } from '../utils/navRoutes';
import { useLocale } from '../i18n/LocaleContext';
import { tGlobal } from '../i18n/runtime';
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
        <div className="flex shrink-0 flex-wrap items-center gap-2 max-sm:[&_.btn]:!px-3 max-sm:[&_.btn]:!py-1.5 max-sm:[&_.btn]:text-xs md:pt-0.5">
          {actions}
        </div>
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
  const { t } = useLocale();
  return (
    <div
      className={clsx(
        'flex flex-col items-center justify-center gap-3',
        fullScreen ? 'min-h-screen bg-panel-canvas dark:bg-panel-canvas-dark' : 'py-28'
      )}
    >
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      <span className="text-sm text-panel-muted dark:text-panel-muted-dark">{t('common.loading')}</span>
    </div>
  );
}

export function Empty({ message }: { message?: string }) {
  const { t } = useLocale();
  return (
    <div className="py-16 text-center text-sm text-panel-muted dark:text-panel-muted-dark">
      {message ?? t('common.noData')}
    </div>
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

export function getStatusLabelMap() {
  return {
    online: tGlobal('status.online'),
    offline: tGlobal('status.offline'),
    error: tGlobal('status.error'),
    maintenance: tGlobal('status.maintenance'),
    in_progress: tGlobal('status.inProgress'),
    completed: tGlobal('status.completed'),
    failed: tGlobal('status.failed'),
  } as const;
}

export function getPeriodLabelMap() {
  return {
    before_collection: tGlobal('common.beforeCollection'),
    after_collection: tGlobal('common.afterCollection'),
  } as const;
}

export function getCategoryLabelMap() {
  return {
    regular: tGlobal('cards.category.regular'),
    unlimited: tGlobal('cards.category.unlimited'),
    service: tGlobal('cards.category.service'),
  } as const;
}

export function getCardTypeLabelMap() {
  return {
    regular: tGlobal('cards.type.regular'),
    unlimited: tGlobal('cards.type.unlimited'),
    service: tGlobal('cards.type.service'),
  } as const;
}

export function getLogCategoryOptions() {
  return [
    { value: '', label: tGlobal('logs.categories.all') },
    { value: 'api_call', label: tGlobal('logs.categories.apiCall') },
    { value: 'error', label: tGlobal('logs.categories.error') },
    { value: 'webhook_dispatch', label: tGlobal('logs.categories.webhookDispatch') },
    { value: 'cron_run', label: tGlobal('logs.categories.cronRun') },
    { value: 'mcp_call', label: tGlobal('logs.categories.mcpCall') },
    { value: 'login', label: tGlobal('logs.categories.login') },
  ];
}

export function getLogLevelOptions() {
  return [
    { value: '', label: tGlobal('logs.levels.all') },
    { value: 'Debug', label: 'Debug' },
    { value: 'Info', label: 'Info' },
    { value: 'Warning', label: 'Warning' },
    { value: 'Error', label: 'Error' },
    { value: 'Critical', label: 'Critical' },
  ];
}
