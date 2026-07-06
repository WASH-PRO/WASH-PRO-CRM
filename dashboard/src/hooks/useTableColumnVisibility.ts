import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';

export function isColumnHideable(column: { key: string; hideable?: boolean }): boolean {
  if (column.hideable === false) return false;
  if (column.key === 'actions') return false;
  return true;
}

function storageKey(userKey: string, tableId: string): string {
  return `wash_table_columns_${userKey}_${tableId}`;
}

function readHiddenKeys(key: string, validKeys: Set<string>): Set<string> {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((item): item is string => typeof item === 'string' && validKeys.has(item)));
  } catch {
    return new Set();
  }
}

function writeHiddenKeys(key: string, hidden: Set<string>): void {
  if (hidden.size === 0) {
    localStorage.removeItem(key);
    return;
  }
  localStorage.setItem(key, JSON.stringify([...hidden]));
}

export function useTableColumnVisibility(
  tableId: string,
  columns: { key: string; header: string; hideable?: boolean }[]
) {
  const { user } = useAuth();
  const userKey = user?.id || user?.login || 'anonymous';

  const hideableColumns = useMemo(() => columns.filter(isColumnHideable), [columns]);
  const hideableKeys = useMemo(() => hideableColumns.map((c) => c.key), [hideableColumns]);
  const hideableKeySet = useMemo(() => new Set(hideableKeys), [hideableKeys]);
  const persistKey = storageKey(userKey, tableId);

  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(() =>
    readHiddenKeys(persistKey, hideableKeySet)
  );

  useEffect(() => {
    const valid = new Set(hideableKeys);
    setHiddenKeys(readHiddenKeys(persistKey, valid));
  }, [persistKey, hideableKeys]);

  const isVisible = useCallback(
    (key: string) => {
      const column = columns.find((c) => c.key === key);
      if (!column || !isColumnHideable(column)) return true;
      return !hiddenKeys.has(key);
    },
    [columns, hiddenKeys]
  );

  const visibleHideableCount = useMemo(
    () => hideableColumns.filter((c) => !hiddenKeys.has(c.key)).length,
    [hideableColumns, hiddenKeys]
  );

  const setColumnVisible = useCallback(
    (key: string, visible: boolean) => {
      if (!hideableKeySet.has(key)) return;
      if (!visible && visibleHideableCount <= 1) return;

      setHiddenKeys((prev) => {
        const next = new Set(prev);
        if (visible) next.delete(key);
        else next.add(key);
        writeHiddenKeys(persistKey, next);
        return next;
      });
    },
    [hideableKeySet, persistKey, visibleHideableCount]
  );

  const resetColumns = useCallback(() => {
    setHiddenKeys(new Set());
    localStorage.removeItem(persistKey);
  }, [persistKey]);

  const hasCustomVisibility = hiddenKeys.size > 0;

  return {
    hideableColumns,
    hiddenKeys,
    isVisible,
    setColumnVisible,
    resetColumns,
    hasCustomVisibility,
  };
}
