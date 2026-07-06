import { useEffect, useRef, useState } from 'react';
import { Columns3, RotateCcw } from 'lucide-react';
import clsx from 'clsx';

interface TableColumnPickerProps {
  columns: { key: string; header: string }[];
  hiddenKeys: Set<string>;
  isVisible: (key: string) => boolean;
  onToggle: (key: string, visible: boolean) => void;
  onReset: () => void;
  hasCustomVisibility: boolean;
}

export function TableColumnPicker({
  columns,
  hiddenKeys,
  isVisible,
  onToggle,
  onReset,
  hasCustomVisibility,
}: TableColumnPickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  if (columns.length === 0) return null;

  const hiddenCount = hiddenKeys.size;

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        className={clsx(
          'btn-secondary !h-9 gap-2 !px-3 text-sm',
          hasCustomVisibility && 'border-brand-500/30 text-brand-700 dark:text-brand-300'
        )}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        title="Настройка столбцов"
      >
        <Columns3 size={16} />
        <span className="hidden sm:inline">Столбцы</span>
        {hiddenCount > 0 && (
          <span className="rounded-full bg-brand-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700 dark:text-brand-300">
            −{hiddenCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Отображение столбцов"
          className="absolute right-0 z-30 mt-2 w-[min(18rem,calc(100vw-2rem))] rounded-panel border border-panel-border bg-panel-card p-3 shadow-panel-lg dark:border-panel-border-dark dark:bg-panel-card-dark"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-panel-ink dark:text-panel-ink-dark">Столбцы таблицы</p>
            <button
              type="button"
              className="btn-ghost !px-2 !py-1 text-xs"
              onClick={onReset}
              disabled={!hasCustomVisibility}
              title="Показать все столбцы"
            >
              <RotateCcw size={14} className="mr-1 inline" />
              Сбросить
            </button>
          </div>
          <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
            {columns.map((column) => {
              const visible = isVisible(column.key);
              const onlyVisible = visible && columns.filter((c) => isVisible(c.key)).length === 1;
              return (
                <label
                  key={column.key}
                  className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-panel-canvas dark:hover:bg-white/[0.03]"
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 shrink-0"
                    checked={visible}
                    disabled={onlyVisible}
                    onChange={(e) => onToggle(column.key, e.target.checked)}
                  />
                  <span className="leading-snug">{column.header || column.key}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
