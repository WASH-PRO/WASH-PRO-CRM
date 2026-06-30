import Button from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { TH } from "@/components/ui/Table";
import { useTranslation } from "@/context/LocaleContext";
import { cn } from "@/lib/cn";
import { PAGE_SIZE_OPTIONS } from "@/hooks/useDataTable";
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  ChevronUpDownIcon,
  XMarkIcon,
} from "@heroicons/react/20/solid";
import type { ReactNode } from "react";
import type { SortState } from "@/hooks/useDataTable";

export interface ToolbarFilter {
  id: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}

interface DataTableToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  filters?: ToolbarFilter[];
  pageSize: number;
  onPageSizeChange: (size: number) => void;
  onClear?: () => void;
  showClear?: boolean;
}

export function DataTableToolbar({
  search,
  onSearchChange,
  searchPlaceholder = "Search…",
  filters = [],
  pageSize,
  onPageSizeChange,
  onClear,
  showClear,
}: DataTableToolbarProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-3 border-b border-line bg-surface-muted px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between lg:px-5">
      <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">
        <div className="w-full sm:max-w-xs">
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label={t("table.search")}
          />
        </div>
        {filters.map((filter) => (
          <div key={filter.id} className="flex items-center gap-2">
            <label htmlFor={`filter-${filter.id}`} className="shrink-0 text-xs font-medium text-faint">
              {filter.label}
            </label>
            <Select
              id={`filter-${filter.id}`}
              value={filter.value}
              onChange={(e) => filter.onChange(e.target.value)}
              className="min-w-[8rem]"
            >
              {filter.options.map((opt) => (
                <option key={opt.value || "all"} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label htmlFor="page-size" className="text-xs font-medium text-faint">
            {t("table.rows")}
          </label>
          <Select
            id="page-size"
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="w-20"
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </Select>
        </div>
        {showClear && onClear && (
          <Button variant="ghost" size="sm" icon={<XMarkIcon className="size-4" />} onClick={onClear}>
            {t("common.reset")}
          </Button>
        )}
      </div>
    </div>
  );
}

interface DataTablePaginationProps {
  page: number;
  totalPages: number;
  rangeStart: number;
  rangeEnd: number;
  filteredCount: number;
  totalCount: number;
  onPageChange: (page: number) => void;
}

export function DataTablePagination({
  page,
  totalPages,
  rangeStart,
  rangeEnd,
  filteredCount,
  totalCount,
  onPageChange,
}: DataTablePaginationProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-3 border-t border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between lg:px-5">
      <p className="text-sm text-faint">
        {filteredCount === 0 ? (
          t("table.noRecords")
        ) : (
          <>
            {t("table.showing")}{" "}
            <span className="font-medium text-foreground-secondary">{rangeStart}</span>–
            <span className="font-medium text-foreground-secondary">{rangeEnd}</span> {t("table.of")}{" "}
            <span className="font-medium text-foreground-secondary">{filteredCount}</span>
            {filteredCount !== totalCount && (
              <span className="text-dim"> {t("table.filteredFrom", { total: totalCount })}</span>
            )}
          </>
        )}
      </p>

      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          icon={<ChevronLeftIcon className="size-4" />}
        >
          {t("table.previous")}
        </Button>
        <span className="min-w-[4.5rem] text-center text-sm tabular-nums text-muted">
          {page} / {totalPages}
        </span>
        <Button
          variant="secondary"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          icon={<ChevronRightIcon className="size-4" />}
        >
          {t("table.next")}
        </Button>
      </div>
    </div>
  );
}

export function SortableTH({
  label,
  sortKey,
  sort,
  onSort,
  align = "left",
  className,
}: {
  label: string;
  sortKey: string;
  sort: SortState | null;
  onSort: (key: string) => void;
  align?: "left" | "right" | "center";
  className?: string;
}) {
  const active = sort?.key === sortKey;
  const Icon = active ? (sort.dir === "asc" ? ChevronUpIcon : ChevronDownIcon) : ChevronUpDownIcon;

  return (
    <TH align={align} className={className}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          "group inline-flex items-center gap-1 transition-colors hover:text-foreground-secondary",
          active ? "text-foreground-secondary" : "text-faint",
          align === "right" && "ml-auto",
        )}
      >
        {label}
        <Icon className={cn("size-3.5", !active && "opacity-40 group-hover:opacity-70")} />
      </button>
    </TH>
  );
}

export function DataTableShell({
  toolbar,
  bulkBar,
  pagination,
  children,
  className,
}: {
  toolbar: ReactNode;
  bulkBar?: ReactNode;
  pagination: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("overflow-hidden rounded-xl bg-panel-muted ring-1 ring-ring-line", className)}>
      {toolbar}
      {bulkBar}
      <div className="overflow-x-auto">{children}</div>
      {pagination}
    </div>
  );
}
