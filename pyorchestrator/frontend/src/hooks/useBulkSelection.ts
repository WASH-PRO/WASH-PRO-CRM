import { useCallback, useEffect, useMemo, useState } from "react";

export function useBulkSelection(pageIds: string[]) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const pageKey = pageIds.join("|");

  useEffect(() => {
    setSelected(new Set());
  }, [pageKey]);

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelected(new Set(pageIds));
  }, [pageIds]);

  const clear = useCallback(() => {
    setSelected(new Set());
  }, []);

  const isSelected = useCallback((id: string) => selected.has(id), [selected]);

  const allSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const someSelected = selected.size > 0 && !allSelected;
  const selectedIds = useMemo(() => [...selected], [selected]);

  return {
    selectedIds,
    count: selected.size,
    toggle,
    selectAll,
    clear,
    isSelected,
    allSelected,
    someSelected,
  };
}
