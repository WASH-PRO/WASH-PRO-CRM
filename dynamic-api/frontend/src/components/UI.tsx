import { ReactNode } from 'react';
import { Search } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  color: string;
  subtitle?: string;
}

export function StatCard({ title, value, icon: Icon, color, subtitle }: StatCardProps) {
  return (
    <div className="stat-card">
      <div className="flex items-center justify-between">
        <span className="text-dark-muted text-sm">{title}</span>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center`} style={{ backgroundColor: `${color}20` }}>
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
      </div>
      <div className="text-2xl font-bold">{value}</div>
      {subtitle && <span className="text-xs text-dark-muted">{subtitle}</span>}
    </div>
  );
}

export function MethodBadge({ method }: { method: string }) {
  return (
    <span className={`method-badge method-${method.toLowerCase()}`}>
      {method}
    </span>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
      <div>
        <h1 className="text-xl font-bold">{title}</h1>
        {subtitle && <p className="text-sm text-dark-muted mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search...',
  className = '',
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-muted" />
      <input
        className="input pl-10"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-dark-card border border-dark-border rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-dark-border">
          <h2 className="font-semibold">{title}</h2>
          <button onClick={onClose} className="text-dark-muted hover:text-dark-text text-xl leading-none">&times;</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-12 text-dark-muted">
      <p>{message}</p>
    </div>
  );
}

export interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
  onLimitChange?: (limit: number) => void;
  limitOptions?: number[];
}

export function Pagination({
  page, totalPages, total, limit, onPageChange, onLimitChange,
  limitOptions = [10, 20, 50, 100],
}: PaginationProps) {
  if (total === 0) return null;

  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  const pages: (number | '...')[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push('...');
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push('...');
    pages.push(totalPages);
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 pt-4 border-t border-dark-border">
      <p className="text-sm text-dark-muted">
        Showing <span className="text-dark-text font-medium">{from}–{to}</span> of{' '}
        <span className="text-dark-text font-medium">{total}</span>
      </p>

      <div className="flex items-center gap-2">
        {onLimitChange && (
          <select
            className="select w-auto py-1.5 text-xs"
            value={limit}
            onChange={(e) => onLimitChange(parseInt(e.target.value, 10))}
          >
            {limitOptions.map((n) => (
              <option key={n} value={n}>{n} / page</option>
            ))}
          </select>
        )}

        <button
          className="btn-secondary py-1.5 px-2.5"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          ←
        </button>

        {pages.map((p, i) =>
          p === '...' ? (
            <span key={`dots-${i}`} className="text-dark-muted px-1">…</span>
          ) : (
            <button
              key={p}
              className={`min-w-[32px] py-1.5 px-2 rounded-md text-sm font-medium transition-colors ${
                p === page
                  ? 'bg-primary-600 text-white'
                  : 'bg-dark-hover text-dark-muted hover:text-dark-text'
              }`}
              onClick={() => onPageChange(p)}
            >
              {p}
            </button>
          )
        )}

        <button
          className="btn-secondary py-1.5 px-2.5"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          →
        </button>
      </div>
    </div>
  );
}
