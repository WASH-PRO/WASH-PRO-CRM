import { ReactNode } from 'react';
import clsx from 'clsx';
export { CARD_STATUS_LABELS as cardStatusLabel } from '../utils/cards';

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 border-b border-panel-border pb-6 dark:border-panel-border-dark sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-panel-ink dark:text-panel-ink-dark lg:text-[1.75rem]">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1.5 text-sm leading-relaxed text-panel-muted dark:text-panel-muted-dark">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="panel-stat">
      <div className="text-xs font-medium uppercase tracking-wide text-panel-muted dark:text-panel-muted-dark">
        {label}
      </div>
      <div className="mt-2 font-display text-2xl font-semibold tracking-tight text-panel-ink dark:text-panel-ink-dark">
        {value}
      </div>
      {hint && <div className="mt-2 text-xs text-panel-muted dark:text-panel-muted-dark">{hint}</div>}
    </div>
  );
}

export function Badge({ children, variant = 'default' }: { children: ReactNode; variant?: 'default' | 'success' | 'warning' | 'error' }) {
  const colors = {
    default: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    success: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/10 dark:bg-emerald-500/10 dark:text-emerald-300',
    warning: 'bg-amber-50 text-amber-800 ring-1 ring-amber-600/10 dark:bg-amber-500/10 dark:text-amber-300',
    error: 'bg-red-50 text-red-700 ring-1 ring-red-600/10 dark:bg-red-500/10 dark:text-red-300',
  };
  return (
    <span className={clsx('inline-flex rounded-md px-2 py-0.5 text-xs font-medium', colors[variant])}>
      {children}
    </span>
  );
}

export function Loading() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-28">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      <span className="text-sm text-panel-muted dark:text-panel-muted-dark">Загрузка данных…</span>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-panel border border-panel-border bg-panel-card p-6 shadow-panel-lg dark:border-panel-border-dark dark:bg-panel-card-dark">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          <button type="button" onClick={onClose} className="btn-ghost !px-2 !py-1 text-lg leading-none">
            ×
          </button>
        </div>
        {children}
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
