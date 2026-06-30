import { useCallback, useMemo, useState } from "react";
import { TrashIcon } from "@heroicons/react/20/solid";
import PageContainer, { PageContent } from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import Badge, { type BadgeTone } from "@/components/ui/Badge";
import BulkActionsBar from "@/components/ui/BulkActionsBar";
import Button, { IconButton } from "@/components/ui/Button";
import {
  DataTablePagination,
  DataTableShell,
  DataTableToolbar,
  SortableTH,
} from "@/components/ui/DataTable";
import { SelectionCheckbox } from "@/components/ui/SelectionCheckbox";
import { EmptyRow, Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { compareStrings, useDataTable } from "@/hooks/useDataTable";
import { useBulkSelection } from "@/hooks/useBulkSelection";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { api } from "@/api/client";
import { useTranslation } from "@/context/LocaleContext";

interface Notification {
  id: string;
  title: string;
  body: string;
  severity: string;
  is_read: boolean;
}

function severityTone(s: string): BadgeTone {
  if (s === "error") return "danger";
  if (s === "warning") return "warning";
  if (s === "info") return "accent";
  return "neutral";
}

export default function NotificationsPage() {
  const { t } = useTranslation();
  const [bulkBusy, setBulkBusy] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

  const severityOptions = useMemo(
    () => [
      { value: "", label: t("filters.allSeverities") },
      { value: "info", label: t("filters.info") },
      { value: "warning", label: t("filters.warning") },
      { value: "error", label: t("filters.error") },
    ],
    [t],
  );

  const readOptions = useMemo(
    () => [
      { value: "", label: t("filters.all") },
      { value: "unread", label: t("filters.unread") },
      { value: "read", label: t("filters.read") },
    ],
    [t],
  );

  const fetchNotifications = useCallback(() => api<Notification[]>("/api/v1/notifications"), []);
  const { data: items = [], reload, refreshing, lastUpdated } = useLiveQuery(fetchNotifications, []);

  const table = useDataTable({
    data: items,
    defaultSort: { key: "title", dir: "asc" },
    searchFn: (row, q) =>
      row.title.toLowerCase().includes(q) || row.body.toLowerCase().includes(q),
    filters: [
      {
        id: "severity",
        label: t("common.severity"),
        options: severityOptions,
        predicate: (row, value) => row.severity === value,
      },
      {
        id: "read",
        label: t("common.status"),
        options: readOptions,
        predicate: (row, value) => {
          if (value === "unread") return !row.is_read;
          if (value === "read") return row.is_read;
          return true;
        },
      },
    ],
    sortFns: {
      title: (a, b) => compareStrings(a.title, b.title),
      severity: (a, b) => compareStrings(a.severity, b.severity),
      is_read: (a, b) => Number(a.is_read) - Number(b.is_read),
    },
  });

  const pageIds = useMemo(() => table.rows.map((row) => row.id), [table.rows]);
  const bulk = useBulkSelection(pageIds);
  const unreadSelectedCount = useMemo(
    () => table.rows.filter((row) => bulk.isSelected(row.id) && !row.is_read).length,
    [table.rows, bulk.isSelected, bulk.selectedIds],
  );

  const toolbarFilters = useMemo(
    () => [
      {
        id: "severity",
        label: t("common.severity"),
        value: table.filterValues.severity ?? "",
        options: severityOptions,
        onChange: (v: string) => table.setFilter("severity", v),
      },
      {
        id: "read",
        label: t("common.status"),
        value: table.filterValues.read ?? "",
        options: readOptions,
        onChange: (v: string) => table.setFilter("read", v),
      },
    ],
    [table.filterValues, table.setFilter, severityOptions, readOptions, t],
  );

  const runBulk = async (ids: string[], task: (id: string) => Promise<void>) => {
    setBulkBusy(true);
    try {
      for (const id of ids) await task(id);
      bulk.clear();
      reload();
    } finally {
      setBulkBusy(false);
    }
  };

  const bulkMarkRead = async () => {
    const unreadIds = table.rows
      .filter((row) => bulk.isSelected(row.id) && !row.is_read)
      .map((row) => row.id);
    if (unreadIds.length === 0) return;
    await runBulk(unreadIds, (id) => api(`/api/v1/notifications/${id}/read`, { method: "POST" }));
  };

  const bulkDelete = async () => {
    if (!window.confirm(t("notifications.confirmBulkDelete", { count: bulk.count }))) return;
    await runBulk(bulk.selectedIds, (id) => api(`/api/v1/notifications/${id}`, { method: "DELETE" }));
  };

  const markRead = async (id: string) => {
    setActionId(id);
    try {
      await api(`/api/v1/notifications/${id}/read`, { method: "POST" });
      reload();
    } finally {
      setActionId(null);
    }
  };

  const remove = async (n: Notification) => {
    if (!window.confirm(t("notifications.confirmDelete", { title: n.title }))) return;
    setActionId(n.id);
    try {
      await api(`/api/v1/notifications/${n.id}`, { method: "DELETE" });
      reload();
    } finally {
      setActionId(null);
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title={t("notifications.title")}
        subtitle={t("notifications.subtitle")}
        onRefresh={reload}
        refreshing={refreshing}
        lastUpdated={lastUpdated}
      />

      <PageContent>
        <DataTableShell
          toolbar={
            <DataTableToolbar
              search={table.search}
              onSearchChange={table.setSearch}
              searchPlaceholder={t("notifications.searchPlaceholder")}
              filters={toolbarFilters}
              pageSize={table.pageSize}
              onPageSizeChange={table.setPageSize}
              showClear={table.hasActiveFilters}
              onClear={table.clearFilters}
            />
          }
          bulkBar={
            <BulkActionsBar
              count={bulk.count}
              onClear={bulk.clear}
              busy={bulkBusy}
              actions={[
                {
                  id: "read",
                  label:
                    unreadSelectedCount > 0
                      ? t("notifications.markReadCount", { count: unreadSelectedCount })
                      : t("notifications.markRead"),
                  disabled: unreadSelectedCount === 0,
                  onClick: bulkMarkRead,
                },
                {
                  id: "delete",
                  label: t("common.delete"),
                  variant: "danger",
                  onClick: bulkDelete,
                },
              ]}
            />
          }
          pagination={
            <DataTablePagination
              page={table.page}
              totalPages={table.totalPages}
              rangeStart={table.rangeStart}
              rangeEnd={table.rangeEnd}
              filteredCount={table.filteredCount}
              totalCount={table.totalCount}
              onPageChange={table.setPage}
            />
          }
        >
          <Table>
            <THead>
              <TH align="center" className="w-10 px-3">
                <SelectionCheckbox
                  checked={bulk.allSelected}
                  indeterminate={bulk.someSelected}
                  onChange={() => (bulk.allSelected ? bulk.clear() : bulk.selectAll())}
                  ariaLabel={t("common.selectAllOnPage")}
                  disabled={bulkBusy}
                />
              </TH>
              <SortableTH label={t("notifications.columns.title")} sortKey="title" sort={table.sort} onSort={table.toggleSort} className="w-[22%]" />
              <TH className="w-[40%]">{t("notifications.columns.message")}</TH>
              <SortableTH label={t("common.severity")} sortKey="severity" sort={table.sort} onSort={table.toggleSort} className="w-[10%]" />
              <SortableTH label={t("common.status")} sortKey="is_read" sort={table.sort} onSort={table.toggleSort} className="w-[10%]" />
              <TH align="right" className="w-[14%]">
                {t("common.actions")}
              </TH>
            </THead>
            <TBody>
              {table.rows.map((n) => {
                const busy = actionId === n.id || bulkBusy;
                return (
                  <TR key={n.id} selected={bulk.isSelected(n.id)}>
                    <TD align="center" className="w-10 px-3">
                      <SelectionCheckbox
                        checked={bulk.isSelected(n.id)}
                        onChange={() => bulk.toggle(n.id)}
                        ariaLabel={t("common.selectItem", { name: n.title })}
                        disabled={bulkBusy}
                      />
                    </TD>
                    <TD>
                      <span className="font-semibold text-foreground">{n.title}</span>
                    </TD>
                    <TD>
                      <p className="line-clamp-2 text-sm leading-relaxed text-muted">{n.body}</p>
                    </TD>
                    <TD>
                      <Badge label={n.severity} tone={severityTone(n.severity)} />
                    </TD>
                    <TD>
                      <Badge
                        label={n.is_read ? t("common.read") : t("common.unread")}
                        tone={n.is_read ? "neutral" : "accent"}
                      />
                    </TD>
                    <TD align="right">
                      <div className="inline-flex items-center justify-end gap-1">
                        {!n.is_read && (
                          <Button size="sm" variant="secondary" disabled={busy} onClick={() => markRead(n.id)}>
                            {t("common.read")}
                          </Button>
                        )}
                        <IconButton
                          aria-label={t("common.deleteItem", { item: n.title })}
                          disabled={busy}
                          onClick={() => remove(n)}
                          className="hover:text-red-400"
                        >
                          <TrashIcon className="size-4" />
                        </IconButton>
                      </div>
                    </TD>
                  </TR>
                );
              })}
              {table.filteredCount === 0 && (
                <EmptyRow
                  colSpan={6}
                  message={items.length ? t("notifications.emptyFiltered") : t("notifications.empty")}
                />
              )}
            </TBody>
          </Table>
        </DataTableShell>
      </PageContent>
    </PageContainer>
  );
}
