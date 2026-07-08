import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Search } from 'lucide-react';
import clsx from 'clsx';
import { Empty } from './UI';
import { TableColumnPicker } from './TableColumnPicker';
import { useTableColumnVisibility } from '../hooks/useTableColumnVisibility';

export interface DataTableColumn<T> {
  key: string;
  header: string;
  sortable?: boolean;
  hideable?: boolean;
  render?: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number;
  searchValue?: (row: T) => string;
  className?: string;
}

export interface DataTableFilter<T> {
  id: string;
  label: string;
  options: { value: string; label: string }[];
  allLabel?: string;
  match: (row: T, value: string) => boolean;
}

export interface DataTableBulkAction<T> {
  id: string;
  label: string;
  variant?: 'primary' | 'secondary' | 'danger';
  confirmMessage?: (rows: T[], ids: string[]) => string;
  disabled?: (rows: T[], ids: string[]) => boolean;
  onAction: (rows: T[], ids: string[]) => void | Promise<void>;
}

interface DataTableProps<T> {
  tableId: string;
  columns: DataTableColumn<T>[];
  data: T[];
  rowKey: (row: T) => string;
  searchPlaceholder?: string;
  pageSize?: number;
  emptyMessage?: string;
  toolbar?: ReactNode;
  toolbarPlacement?: 'start' | 'end';
  filters?: DataTableFilter<T>[];
  filterValues?: Record<string, string>;
  onFilterChange?: (id: string, value: string) => void;
  bulkActions?: DataTableBulkAction<T>[];
  isRowSelectable?: (row: T) => boolean;
  onRowClick?: (row: T) => void;
  isRowActive?: (row: T) => boolean;
  defaultSortKey?: string | null;
  defaultSortDir?: 'asc' | 'desc';
}

function resolveSortable<T>(col: DataTableColumn<T>): DataTableColumn<T> {
  const sortValue = col.sortValue ?? (col.searchValue ? (row: T) => col.searchValue!(row) : undefined);
  const sortable = col.sortable !== false && !!sortValue;
  return { ...col, sortValue, sortable };
}

function isCompactColumn<T>(col: DataTableColumn<T>): boolean {
  if (col.key === 'actions') return true;
  const className = col.className ?? '';
  return className.includes('whitespace-nowrap') || className.includes('w-0');
}

function tableCellClass<T>(col: DataTableColumn<T>): string | undefined {
  return clsx(col.className, isCompactColumn(col) ? 'table-cell-nowrap' : undefined);
}

export function DataTable<T>({
  tableId,
  columns,
  data,
  rowKey,
  searchPlaceholder = 'Поиск…',
  pageSize: initialPageSize = 100,
  emptyMessage = 'Нет данных',
  toolbar,
  toolbarPlacement = 'end',
  filters = [],
  filterValues: controlledFilterValues,
  onFilterChange,
  bulkActions = [],
  isRowSelectable,
  onRowClick,
  isRowActive,
  defaultSortKey = null,
  defaultSortDir = 'asc',
}: DataTableProps<T>) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(defaultSortKey);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(defaultSortDir);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [visibleCount, setVisibleCount] = useState(initialPageSize);
  const [internalFilterValues, setInternalFilterValues] = useState<Record<string, string>>({});
  const mergedFilterValues = { ...internalFilterValues, ...(controlledFilterValues ?? {}) };
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [runningActionId, setRunningActionId] = useState<string | null>(null);
  const headerCheckboxRef = useRef<HTMLInputElement>(null);

  const selectable = bulkActions.length > 0;
  const canSelect = (row: T) => !isRowSelectable || isRowSelectable(row);

  const resolvedColumns = useMemo(() => columns.map(resolveSortable), [columns]);
  const {
    hideableColumns,
    hiddenKeys,
    isVisible,
    setColumnVisible,
    resetColumns,
    hasCustomVisibility,
  } = useTableColumnVisibility(tableId, columns);
  const displayColumns = useMemo(
    () => resolvedColumns.filter((col) => isVisible(col.key)),
    [resolvedColumns, isVisible, hiddenKeys]
  );
  const searchableColumns = displayColumns.filter((c) => c.searchValue);

  const filtered = useMemo(() => {
    let rows = data;

    for (const f of filters) {
      const val = mergedFilterValues[f.id];
      if (val) rows = rows.filter((row) => f.match(row, val));
    }

    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter((row) =>
        searchableColumns.some((col) => (col.searchValue!(row) || '').toLowerCase().includes(q))
      );
    }

    return rows;
  }, [data, search, searchableColumns, filters, mergedFilterValues]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const col = displayColumns.find((c) => c.key === sortKey);
    if (!col?.sortValue) return filtered;
    return [...filtered].sort((a, b) => {
      const av = col.sortValue!(a);
      const bv = col.sortValue!(b);
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filtered, sortKey, sortDir, displayColumns]);

  const paged = useMemo(() => sorted.slice(0, visibleCount), [sorted, visibleCount]);
  const hasMore = sorted.length > paged.length;
  const nextChunk = Math.min(pageSize, sorted.length - paged.length);

  const pageSizeOptions = useMemo(() => {
    const opts = new Set([50, 100, 200, 500, 1000, pageSize]);
    return [...opts].sort((a, b) => a - b);
  }, [pageSize]);

  useEffect(() => {
    setPageSize(initialPageSize);
    setVisibleCount(initialPageSize);
  }, [initialPageSize]);

  const changePageSize = (size: number) => {
    setPageSize(size);
    setVisibleCount(size);
  };

  const rowById = useMemo(() => new Map(data.map((row) => [rowKey(row), row])), [data, rowKey]);
  const selectableFilteredIds = useMemo(
    () => sorted.filter(canSelect).map((row) => rowKey(row)),
    [sorted, isRowSelectable]
  );
  const selectablePageIds = useMemo(
    () => paged.filter(canSelect).map((row) => rowKey(row)),
    [paged, isRowSelectable]
  );

  const selectedRows = useMemo(
    () => [...selectedIds].map((id) => rowById.get(id)).filter((row): row is T => row != null),
    [selectedIds, rowById]
  );

  const pageAllSelected =
    selectablePageIds.length > 0 && selectablePageIds.every((id) => selectedIds.has(id));
  const pageSomeSelected =
    selectablePageIds.some((id) => selectedIds.has(id)) && !pageAllSelected;
  const allFilteredSelected =
    selectableFilteredIds.length > 0 && selectableFilteredIds.every((id) => selectedIds.has(id));

  useEffect(() => {
    const checkbox = headerCheckboxRef.current;
    if (checkbox) checkbox.indeterminate = pageSomeSelected;
  }, [pageSomeSelected]);

  useEffect(() => {
    const validIds = new Set(data.map(rowKey));
    setSelectedIds((prev) => {
      const next = new Set([...prev].filter((id) => validIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [data, rowKey]);

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const setFilter = (id: string, value: string) => {
    const isControlled =
      controlledFilterValues !== undefined &&
      Object.prototype.hasOwnProperty.call(controlledFilterValues, id);
    if (!isControlled) {
      setInternalFilterValues((prev) => ({ ...prev, [id]: value }));
    }
    onFilterChange?.(id, value);
    setVisibleCount(pageSize);
  };

  const toggleRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const togglePage = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (pageAllSelected) {
        selectablePageIds.forEach((id) => next.delete(id));
      } else {
        selectablePageIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelectedIds(new Set(selectableFilteredIds));
  };

  const clearSelection = () => setSelectedIds(new Set());

  const runBulkAction = async (action: DataTableBulkAction<T>) => {
    const ids = selectedRows.map((row) => rowKey(row));
    if (ids.length === 0 || action.disabled?.(selectedRows, ids)) return;

    const message = action.confirmMessage?.(selectedRows, ids);
    if (message && !confirm(message)) return;

    setRunningActionId(action.id);
    try {
      await action.onAction(selectedRows, ids);
      clearSelection();
    } catch (err) {
      console.error('Bulk action failed:', err);
    } finally {
      setRunningActionId(null);
    }
  };

  const actionButtonClass = (variant: DataTableBulkAction<T>['variant'] = 'secondary') => {
    if (variant === 'primary') return 'btn-primary btn-sm';
    if (variant === 'danger') return 'btn-secondary btn-sm text-red-600 dark:text-red-400';
    return 'btn-secondary btn-sm';
  };

  return (
    <div className="space-y-4">
      <div className="data-toolbar">
        <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-stretch md:gap-4">
          {toolbarPlacement === 'start' && (
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{toolbar}</div>
          )}
          <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-center md:w-auto md:flex-1">
            <div
              className={clsx(
                'search-field',
                toolbarPlacement === 'start' ? 'md:max-w-sm lg:ml-auto' : 'md:max-w-md'
              )}
            >
              <Search size={16} className="search-field-icon" />
              <input
                className="input-search"
                placeholder={searchPlaceholder}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setVisibleCount(pageSize);
                }}
              />
            </div>
            <TableColumnPicker
              columns={hideableColumns}
              hiddenKeys={hiddenKeys}
              isVisible={isVisible}
              onToggle={setColumnVisible}
              onReset={resetColumns}
              hasCustomVisibility={hasCustomVisibility}
            />
          </div>
          {toolbarPlacement === 'end' && (
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{toolbar}</div>
          )}
        </div>

        {filters.length > 0 && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fill,minmax(10rem,1fr))]">
            {filters.map((f) => (
              <div key={f.id} className="min-w-0">
                <label className="label !mb-1">{f.label}</label>
                <select
                  className="input input-sm"
                  value={mergedFilterValues[f.id] || ''}
                  onChange={(e) => setFilter(f.id, e.target.value)}
                >
                  <option value="">{f.allLabel ?? 'Все'}</option>
                  {f.options.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectable && selectedIds.size > 0 && (
        <div className="table-selection-bar">
          <span className="font-medium text-brand-800 dark:text-brand-300">
            Выбрано: {selectedIds.size}
          </span>
          {bulkActions.map((action) => {
            const ids = selectedRows.map((row) => rowKey(row));
            const disabled = runningActionId != null || action.disabled?.(selectedRows, ids);
            return (
              <button
                key={action.id}
                type="button"
                className={actionButtonClass(action.variant)}
                disabled={disabled}
                onClick={() => runBulkAction(action)}
              >
                {runningActionId === action.id ? 'Выполняется…' : action.label}
              </button>
            );
          })}
          <button type="button" className="btn-secondary btn-sm" onClick={clearSelection}>
            Снять выделение
          </button>
        </div>
      )}

      <div className="table-shell overflow-x-auto">
        <table>
          <thead>
            <tr>
              {selectable && (
                <th className="table-cell-nowrap w-10">
                  <input
                    ref={headerCheckboxRef}
                    type="checkbox"
                    className="rounded border-slate-300"
                    checked={pageAllSelected}
                    onChange={togglePage}
                    aria-label="Выбрать все на странице"
                  />
                </th>
              )}
              {displayColumns.map((col) => (
                <th key={col.key} className={tableCellClass(col)}>
                  {col.sortable ? (
                    <button
                      type="button"
                      className="inline-flex max-w-full items-center gap-1 hover:text-brand-600"
                      onClick={() => toggleSort(col.key)}
                    >
                      {isCompactColumn(col) ? (
                        col.header
                      ) : (
                        <span className="table-cell-content">{col.header}</span>
                      )}
                      {sortKey === col.key && (sortDir === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                    </button>
                  ) : isCompactColumn(col) ? (
                    col.header
                  ) : (
                    <span className="table-cell-content">{col.header}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr>
                <td colSpan={displayColumns.length + (selectable ? 1 : 0)}>
                  <Empty message={emptyMessage} />
                </td>
              </tr>
            ) : (
              paged.map((row) => {
                const id = rowKey(row);
                const rowSelectable = canSelect(row);
                return (
                  <tr
                    key={id}
                    className={clsx(
                      selectedIds.has(id) && 'bg-brand-500/5 dark:bg-brand-400/10',
                      isRowActive?.(row) && 'bg-brand-500/10 ring-1 ring-inset ring-brand-500/30 dark:bg-brand-400/15',
                      onRowClick && 'cursor-pointer'
                    )}
                    onClick={(e) => {
                      if (!onRowClick) return;
                      const target = e.target as HTMLElement;
                      if (target.closest('button, a, input, label, select, textarea')) return;
                      onRowClick(row);
                    }}
                  >
                    {selectable && (
                      <td className="table-cell-nowrap w-10">
                        <input
                          type="checkbox"
                          className="rounded border-slate-300"
                          checked={selectedIds.has(id)}
                          disabled={!rowSelectable}
                          onChange={() => toggleRow(id)}
                          aria-label="Выбрать строку"
                        />
                      </td>
                    )}
                    {displayColumns.map((col) => (
                      <td key={col.key} className={tableCellClass(col)}>
                        {isCompactColumn(col) ? (
                          col.render ? col.render(row) : null
                        ) : (
                          <div className="table-cell-content">
                            {col.render ? col.render(row) : null}
                          </div>
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="table-footer">
        <div className="flex flex-col gap-1">
          <span>
            {sorted.length} записей
            {hasMore && ` · показано ${paged.length}`}
          </span>
          {selectable && sorted.length > 0 && !allFilteredSelected && selectableFilteredIds.length > selectablePageIds.length && (
            <button
              type="button"
              className="text-left text-brand-600 hover:underline dark:text-brand-400"
              onClick={selectAllFiltered}
            >
              Выбрать все {selectableFilteredIds.length} записей
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-panel-muted dark:text-panel-muted-dark">
            <span>На странице:</span>
            <select
              className="input input-sm w-auto"
              value={pageSize}
              onChange={(e) => changePageSize(Number(e.target.value))}
              aria-label="Записей на странице"
            >
              {pageSizeOptions.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </label>
          {hasMore && (
            <button
              type="button"
              className="btn-secondary btn-sm"
              onClick={() => setVisibleCount((c) => c + pageSize)}
            >
              Загрузить ещё ({nextChunk} записей)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
