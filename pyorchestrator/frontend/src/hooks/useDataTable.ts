import { useCallback, useEffect, useMemo, useState } from "react";

export type SortDir = "asc" | "desc";

export interface SortState {
  key: string;
  dir: SortDir;
}

export interface FilterOption {
  value: string;
  label: string;
}

export interface TableFilter<T> {
  id: string;
  label: string;
  options: FilterOption[];
  predicate: (row: T, value: string) => boolean;
}

export interface UseDataTableOptions<T> {
  data: T[];
  pageSize?: number;
  defaultSort?: SortState | null;
  searchFn?: (row: T, query: string) => boolean;
  filters?: TableFilter<T>[];
  sortFns?: Record<string, (a: T, b: T) => number>;
  initialFilterValues?: Record<string, string>;
}

export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

export function useDataTable<T>({
  data,
  pageSize: initialPageSize = 10,
  defaultSort = null,
  searchFn,
  filters = [],
  sortFns = {},
  initialFilterValues = {},
}: UseDataTableOptions<T>) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortState | null>(defaultSort);
  const [filterValues, setFilterValues] = useState<Record<string, string>>(() => ({
    ...Object.fromEntries(filters.map((f) => [f.id, ""])),
    ...initialFilterValues,
  }));

  useEffect(() => {
    setPage(1);
  }, [search, filterValues, pageSize, data.length]);

  const filtered = useMemo(() => {
    let rows = [...data];
    const q = search.trim().toLowerCase();

    if (q && searchFn) {
      rows = rows.filter((row) => searchFn(row, q));
    }

    for (const filter of filters) {
      const value = filterValues[filter.id];
      if (value) {
        rows = rows.filter((row) => filter.predicate(row, value));
      }
    }

    if (sort && sortFns[sort.key]) {
      rows.sort((a, b) => {
        const cmp = sortFns[sort.key](a, b);
        return sort.dir === "asc" ? cmp : -cmp;
      });
    }

    return rows;
  }, [data, search, filterValues, sort, searchFn, filters, sortFns]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const offset = (safePage - 1) * pageSize;
  const rows = filtered.slice(offset, offset + pageSize);

  const toggleSort = (key: string) => {
    setSort((prev) => {
      if (prev?.key !== key) return { key, dir: "asc" };
      if (prev.dir === "asc") return { key, dir: "desc" };
      return null;
    });
  };

  const setFilter = useCallback((id: string, value: string) => {
    setFilterValues((prev) => ({ ...prev, [id]: value }));
  }, []);

  const clearFilters = useCallback(() => {
    setSearch("");
    setFilterValues(Object.fromEntries(filters.map((f) => [f.id, ""])));
    setSort(defaultSort);
    setPage(1);
  }, [filters, defaultSort]);

  const hasActiveFilters =
    search.trim().length > 0 ||
    Object.values(filterValues).some(Boolean) ||
    (sort !== null && JSON.stringify(sort) !== JSON.stringify(defaultSort));

  return {
    rows,
    filteredCount: filtered.length,
    totalCount: data.length,
    page: safePage,
    setPage,
    pageSize,
    setPageSize,
    totalPages,
    search,
    setSearch,
    sort,
    toggleSort,
    filterValues,
    setFilter,
    clearFilters,
    hasActiveFilters,
    rangeStart: filtered.length ? offset + 1 : 0,
    rangeEnd: Math.min(offset + pageSize, filtered.length),
  };
}

export function compareStrings(a: string | null | undefined, b: string | null | undefined) {
  return (a ?? "").localeCompare(b ?? "", undefined, { sensitivity: "base" });
}

export function compareNumbers(a: number | null | undefined, b: number | null | undefined) {
  return (a ?? 0) - (b ?? 0);
}

export function compareDates(a: string | null | undefined, b: string | null | undefined) {
  const ta = a ? Date.parse(a) : 0;
  const tb = b ? Date.parse(b) : 0;
  return ta - tb;
}
