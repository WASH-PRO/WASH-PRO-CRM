import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownTrayIcon,
  ArrowPathRoundedSquareIcon,
  CloudArrowUpIcon,
  TrashIcon,
} from "@heroicons/react/20/solid";
import PageContainer, { PageContent } from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import Badge from "@/components/ui/Badge";
import BulkActionsBar from "@/components/ui/BulkActionsBar";
import Button, { IconButton } from "@/components/ui/Button";
import {
  DataTablePagination,
  DataTableShell,
  DataTableToolbar,
  SortableTH,
} from "@/components/ui/DataTable";
import { FieldGroup, FieldLabel, Input } from "@/components/ui/Input";
import Panel from "@/components/ui/Panel";
import { SelectionCheckbox } from "@/components/ui/SelectionCheckbox";
import { EmptyRow, Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { compareDates, compareNumbers, compareStrings, useDataTable } from "@/hooks/useDataTable";
import { useBulkSelection } from "@/hooks/useBulkSelection";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { api, apiDownload } from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import { useTranslation } from "@/context/LocaleContext";
import { useToast } from "@/context/ToastContext";

interface Backup {
  id: string;
  backup_type: string;
  status: string;
  size_bytes: number;
  completed_at: string | null;
}

interface BackupSettings {
  enabled: boolean;
  cron_expression: string;
  retention_count: number;
  last_run_at: string | null;
}

function formatSize(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

export default function BackupsPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === "Administrator";
  const [actionId, setActionId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [settingsForm, setSettingsForm] = useState<BackupSettings>({
    enabled: false,
    cron_expression: "0 3 * * *",
    retention_count: 10,
    last_run_at: null,
  });

  const statusOptions = useMemo(
    () => [
      { value: "", label: t("backups.filters.allStatuses") },
      { value: "completed", label: t("backups.filters.completed") },
      { value: "pending", label: t("backups.filters.pending") },
      { value: "failed", label: t("backups.filters.failed") },
    ],
    [t],
  );

  const typeOptions = useMemo(
    () => [
      { value: "", label: t("backups.filters.allTypes") },
      { value: "manual", label: t("backups.filters.manual") },
      { value: "scheduled", label: t("backups.filters.scheduled") },
    ],
    [t],
  );

  const typeLabels = useMemo(
    () => ({
      manual: t("backups.filters.manual"),
      scheduled: t("backups.filters.scheduled"),
      pre_update: t("backups.filters.preUpdate"),
    }),
    [t],
  );

  const statusLabels = useMemo(
    () => ({
      completed: t("backups.filters.completed"),
      pending: t("backups.filters.pending"),
      failed: t("backups.filters.failed"),
    }),
    [t],
  );

  const fetchBackups = useCallback(() => api<Backup[]>("/api/v1/backups"), []);
  const fetchSettings = useCallback(() => api<BackupSettings>("/api/v1/backups/settings"), []);

  const { data: backups = [], reload, refreshing, lastUpdated } = useLiveQuery(fetchBackups, [], {
    enabled: isAdmin,
  });

  const loadSettings = useCallback(async () => {
    const data = await fetchSettings();
    setSettingsForm(data);
  }, [fetchSettings]);

  useEffect(() => {
    if (isAdmin) {
      loadSettings().catch(() => {});
    }
  }, [isAdmin, loadSettings]);

  const table = useDataTable({
    data: backups,
    defaultSort: { key: "completed_at", dir: "desc" },
    searchFn: (row, q) =>
      row.backup_type.toLowerCase().includes(q) ||
      row.status.toLowerCase().includes(q) ||
      (row.completed_at?.toLowerCase().includes(q) ?? false),
    filters: [
      {
        id: "status",
        label: "Status",
        options: statusOptions,
        predicate: (row, value) => row.status === value,
      },
      {
        id: "type",
        label: "Type",
        options: typeOptions,
        predicate: (row, value) => row.backup_type === value,
      },
    ],
    sortFns: {
      backup_type: (a, b) => compareStrings(a.backup_type, b.backup_type),
      status: (a, b) => compareStrings(a.status, b.status),
      size_bytes: (a, b) => compareNumbers(a.size_bytes, b.size_bytes),
      completed_at: (a, b) => compareDates(a.completed_at, b.completed_at),
    },
  });

  const pageIds = useMemo(() => table.rows.map((row) => row.id), [table.rows]);
  const bulk = useBulkSelection(pageIds);
  const selectedBackups = useMemo(
    () => table.rows.filter((row) => bulk.isSelected(row.id)),
    [table.rows, bulk.isSelected, bulk.selectedIds],
  );
  const downloadableCount = selectedBackups.filter((b) => b.status === "completed").length;

  const toolbarFilters = useMemo(
    () => [
      {
        id: "status",
        label: t("common.status"),
        value: table.filterValues.status ?? "",
        options: statusOptions,
        onChange: (v: string) => table.setFilter("status", v),
      },
      {
        id: "type",
        label: t("common.type"),
        value: table.filterValues.type ?? "",
        options: typeOptions,
        onChange: (v: string) => table.setFilter("type", v),
      },
    ],
    [table.filterValues, table.setFilter, statusOptions, typeOptions, t],
  );

  const createBackup = async () => {
    setCreating(true);
    try {
      await api("/api/v1/backups", { method: "POST" });
      reload();
    } finally {
      setCreating(false);
    }
  };

  const saveSettings = async () => {
    setSettingsBusy(true);
    try {
      const data = await api<BackupSettings>("/api/v1/backups/settings", {
        method: "PATCH",
        body: JSON.stringify({
          enabled: settingsForm.enabled,
          cron_expression: settingsForm.cron_expression.trim(),
          retention_count: Number(settingsForm.retention_count),
        }),
      });
      setSettingsForm(data);
      toast.success(t("backups.schedule.saved"));
    } catch {
      toast.error(t("backups.schedule.saveFailed"));
    } finally {
      setSettingsBusy(false);
    }
  };

  const download = async (b: Backup) => {
    if (b.status !== "completed") return;
    setActionId(b.id);
    try {
      await apiDownload(`/api/v1/backups/${b.id}/download`, `pyorch-backup-${b.id}.tar.gz`);
    } finally {
      setActionId(null);
    }
  };

  const restore = async (b: Backup) => {
    if (b.status !== "completed") return;
    if (!window.confirm(t("backups.confirmRestore"))) return;
    setActionId(b.id);
    try {
      const result = await api<{ groups_restored: number; scripts_restored: number; scripts_skipped: number }>(
        `/api/v1/backups/${b.id}/restore`,
        { method: "POST" },
      );
      toast.success(
        t("backups.restoreResult", {
          scripts: result.scripts_restored,
          groups: result.groups_restored,
          skipped: result.scripts_skipped,
        }),
      );
    } finally {
      setActionId(null);
    }
  };

  const remove = async (b: Backup) => {
    const date = b.completed_at ? new Date(b.completed_at).toLocaleString() : "—";
    if (!window.confirm(t("backups.confirmDelete", { date }))) return;
    setActionId(b.id);
    try {
      await api(`/api/v1/backups/${b.id}`, { method: "DELETE" });
      reload();
    } finally {
      setActionId(null);
    }
  };

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

  const bulkDelete = async () => {
    if (!window.confirm(t("backups.confirmBulkDelete", { count: bulk.count }))) return;
    await runBulk(bulk.selectedIds, (id) => api(`/api/v1/backups/${id}`, { method: "DELETE" }));
  };

  const bulkDownload = async () => {
    const completed = selectedBackups.filter((b) => b.status === "completed");
    if (completed.length === 0) return;
    setBulkBusy(true);
    try {
      for (const b of completed) {
        await apiDownload(`/api/v1/backups/${b.id}/download`, `pyorch-backup-${b.id}.tar.gz`);
      }
      bulk.clear();
    } finally {
      setBulkBusy(false);
    }
  };

  if (!isAdmin) {
    return (
      <PageContainer>
        <PageHeader title={t("backups.title")} subtitle={t("backups.restricted")} showRefresh={false} />
        <PageContent>
          <Panel>
            <p className="text-center text-sm text-muted">{t("common.adminRequired")}</p>
          </Panel>
        </PageContent>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title={t("backups.title")}
        subtitle={t("backups.subtitle")}
        onRefresh={reload}
        refreshing={refreshing}
        lastUpdated={lastUpdated}
        action={
          <Button icon={<CloudArrowUpIcon className="size-4" />} disabled={creating} onClick={createBackup}>
            {t("backups.create")}
          </Button>
        }
      />

      <PageContent className="space-y-6">
        <Panel title={t("backups.schedule.title")} subtitle={t("backups.schedule.subtitle")} bodyClassName="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <FieldGroup>
              <label className="flex items-center gap-2 text-sm text-foreground-secondary">
                <input
                  type="checkbox"
                  checked={settingsForm.enabled}
                  onChange={(e) => setSettingsForm({ ...settingsForm, enabled: e.target.checked })}
                  className="size-4 rounded border-line-strong bg-input text-cyan-400"
                />
                {t("backups.schedule.enable")}
              </label>
            </FieldGroup>
            <FieldGroup>
              <FieldLabel htmlFor="backup-cron">{t("backups.schedule.cron")}</FieldLabel>
              <Input
                id="backup-cron"
                value={settingsForm.cron_expression}
                onChange={(e) => setSettingsForm({ ...settingsForm, cron_expression: e.target.value })}
                placeholder="0 3 * * *"
                className="font-mono text-sm"
              />
            </FieldGroup>
            <FieldGroup>
              <FieldLabel htmlFor="backup-retention">{t("backups.schedule.retention")}</FieldLabel>
              <Input
                id="backup-retention"
                type="number"
                min={1}
                max={100}
                value={settingsForm.retention_count}
                onChange={(e) =>
                  setSettingsForm({ ...settingsForm, retention_count: Number(e.target.value) || 1 })
                }
              />
            </FieldGroup>
            <div className="flex flex-col justify-end gap-2">
              <Button disabled={settingsBusy} onClick={saveSettings}>
                {t("backups.schedule.save")}
              </Button>
              {settingsForm.last_run_at && (
                <p className="text-xs text-faint">
                  {t("backups.schedule.lastRun", {
                    date: new Date(settingsForm.last_run_at).toLocaleString(),
                  })}
                </p>
              )}
            </div>
          </div>
          <p className="text-xs text-faint">{t("backups.schedule.hint")}</p>
        </Panel>

        <DataTableShell
          toolbar={
            <DataTableToolbar
              search={table.search}
              onSearchChange={table.setSearch}
              searchPlaceholder={t("backups.searchPlaceholder")}
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
                  id: "download",
                  label:
                    downloadableCount > 0
                      ? t("backups.bulkDownload", { count: downloadableCount })
                      : t("common.download"),
                  disabled: downloadableCount === 0,
                  onClick: bulkDownload,
                },
                { id: "delete", label: t("common.delete"), variant: "danger", onClick: bulkDelete },
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
                />
              </TH>
              <SortableTH label={t("common.type")} sortKey="backup_type" sort={table.sort} onSort={table.toggleSort} className="w-[14%]" />
              <SortableTH label={t("common.status")} sortKey="status" sort={table.sort} onSort={table.toggleSort} className="w-[14%]" />
              <SortableTH label={t("backups.columns.size")} sortKey="size_bytes" sort={table.sort} onSort={table.toggleSort} className="w-[12%]" />
              <SortableTH label={t("backups.columns.completed")} sortKey="completed_at" sort={table.sort} onSort={table.toggleSort} className="w-[30%]" />
              <TH align="right" className="w-[22%]">
                {t("common.actions")}
              </TH>
            </THead>
            <TBody>
              {table.rows.map((b) => {
                const busy = actionId === b.id || bulkBusy;
                const ready = b.status === "completed";
                return (
                  <TR key={b.id} selected={bulk.isSelected(b.id)}>
                    <TD align="center" className="w-10 px-3">
                      <SelectionCheckbox
                        checked={bulk.isSelected(b.id)}
                        onChange={() => bulk.toggle(b.id)}
                        ariaLabel={t("backups.selectBackup")}
                        disabled={bulkBusy}
                      />
                    </TD>
                    <TD>{typeLabels[b.backup_type as keyof typeof typeLabels] ?? b.backup_type}</TD>
                    <TD>
                      <Badge
                        label={statusLabels[b.status as keyof typeof statusLabels] ?? b.status}
                        tone={b.status === "completed" ? "success" : b.status === "failed" ? "danger" : "warning"}
                      />
                    </TD>
                    <TD className="font-mono text-xs">{formatSize(b.size_bytes)}</TD>
                    <TD>{b.completed_at ? new Date(b.completed_at).toLocaleString() : "—"}</TD>
                    <TD align="right">
                      <div className="inline-flex items-center justify-end gap-1">
                        <IconButton
                          aria-label={t("common.restore")}
                          disabled={!ready || busy}
                          onClick={() => restore(b)}
                          className={!ready ? "opacity-40" : undefined}
                        >
                          <ArrowPathRoundedSquareIcon className="size-4" />
                        </IconButton>
                        <IconButton
                          aria-label={t("common.download")}
                          disabled={!ready || busy}
                          onClick={() => download(b)}
                          className={!ready ? "opacity-40" : undefined}
                        >
                          <ArrowDownTrayIcon className="size-4" />
                        </IconButton>
                        <IconButton
                          aria-label={t("common.delete")}
                          disabled={busy}
                          onClick={() => remove(b)}
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
                  message={backups.length ? t("backups.emptyFiltered") : t("backups.empty")}
                />
              )}
            </TBody>
          </Table>
        </DataTableShell>
      </PageContent>
    </PageContainer>
  );
}
