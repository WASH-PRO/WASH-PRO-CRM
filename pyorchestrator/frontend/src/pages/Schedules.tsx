import { useCallback, useEffect, useMemo, useState } from "react";
import { PencilSquareIcon, PlusIcon, TrashIcon } from "@heroicons/react/20/solid";
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
import { FieldGroup, FieldLabel, Input, Select } from "@/components/ui/Input";
import Modal, { ModalActions } from "@/components/ui/Modal";
import { SelectionCheckbox } from "@/components/ui/SelectionCheckbox";
import { EmptyRow, Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { compareStrings, useDataTable } from "@/hooks/useDataTable";
import { useBulkSelection } from "@/hooks/useBulkSelection";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { API_URL, api } from "@/api/client";
import { can, useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { useTranslation } from "@/context/LocaleContext";

interface Schedule {
  id: string;
  script_id: string;
  name: string;
  trigger_type: string;
  cron_expression: string | null;
  interval_seconds: number | null;
  start_at: string | null;
  end_at: string | null;
  max_instances: number;
  max_runtime_seconds: number | null;
  is_active: boolean;
  webhook_token: string | null;
}

interface Script {
  id: string;
  name: string;
}

function toDatetimeLocalValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocalValue(value: string): string | null {
  if (!value) return null;
  return new Date(value).toISOString();
}

const emptyForm = {
  scriptId: "",
  name: "",
  triggerType: "cron",
  cronExpression: "0 * * * *",
  intervalSeconds: 3600,
  startAt: "",
  endAt: "",
  maxInstances: 1,
  maxRuntimeSeconds: "",
  isActive: true,
};

export default function SchedulesPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const { user } = useAuth();
  const canWrite = can(user, "schedules:write");
  const [scripts, setScripts] = useState<Script[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Schedule | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const typeOptions = useMemo(
    () => [
      { value: "", label: t("filters.allTypes") },
      { value: "cron", label: t("schedules.triggers.cron") },
      { value: "interval", label: t("schedules.triggers.interval") },
      { value: "webhook", label: t("schedules.triggers.webhook") },
    ],
    [t],
  );

  const stateOptions = useMemo(
    () => [
      { value: "", label: t("filters.allStates") },
      { value: "active", label: t("common.active") },
      { value: "inactive", label: t("common.inactive") },
    ],
    [t],
  );

  const triggerOptions = useMemo(
    () => [
      { value: "cron", label: t("schedules.triggers.cronDesc") },
      { value: "interval", label: t("schedules.triggers.intervalDesc") },
      { value: "webhook", label: t("schedules.triggers.webhookDesc") },
    ],
    [t],
  );

  const scheduleLabel = useCallback(
    (s: Schedule) => {
      if (s.trigger_type === "webhook") return t("schedules.triggers.httpPost");
      if (s.trigger_type === "cron") return s.cron_expression ?? "—";
      if (s.interval_seconds) return t("schedules.everySeconds", { seconds: s.interval_seconds });
      return "—";
    },
    [t],
  );

  const formatRuntime = useCallback(
    (seconds: number | null) => {
      if (!seconds) return t("schedules.scriptDefault");
      if (seconds < 60) return `${seconds}s`;
      if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
      return `${(seconds / 3600).toFixed(1)} h`;
    },
    [t],
  );

  const formatWindow = useCallback(
    (s: Schedule) => {
      if (!s.start_at && !s.end_at) return t("common.always");
      const fmt = (iso: string) => new Date(iso).toLocaleString();
      if (s.start_at && s.end_at) {
        return t("schedules.windowRange", { start: fmt(s.start_at), end: fmt(s.end_at) });
      }
      if (s.start_at) return t("schedules.windowFrom", { date: fmt(s.start_at) });
      return t("schedules.windowUntil", { date: fmt(s.end_at!) });
    },
    [t],
  );

  const fetchSchedules = useCallback(() => api<Schedule[]>("/api/v1/schedules"), []);
  const { data: schedules = [], reload, refreshing, lastUpdated } = useLiveQuery(fetchSchedules, []);

  useEffect(() => {
    api<Script[]>("/api/v1/scripts").then(setScripts).catch(() => {});
  }, []);

  const scriptName = useCallback(
    (id: string) => scripts.find((s) => s.id === id)?.name ?? id.slice(0, 8),
    [scripts],
  );

  const table = useDataTable({
    data: schedules,
    defaultSort: { key: "name", dir: "asc" },
    searchFn: (row, q) =>
      row.name.toLowerCase().includes(q) ||
      row.trigger_type.toLowerCase().includes(q) ||
      scheduleLabel(row).toLowerCase().includes(q) ||
      scriptName(row.script_id).toLowerCase().includes(q),
    filters: [
      {
        id: "type",
        label: t("common.type"),
        options: typeOptions,
        predicate: (row, value) => row.trigger_type === value,
      },
      {
        id: "state",
        label: t("common.state"),
        options: stateOptions,
        predicate: (row, value) =>
          value === "active" ? row.is_active : value === "inactive" ? !row.is_active : true,
      },
    ],
    sortFns: {
      name: (a, b) => compareStrings(a.name, b.name),
      script: (a, b) => compareStrings(scriptName(a.script_id), scriptName(b.script_id)),
      trigger_type: (a, b) => compareStrings(a.trigger_type, b.trigger_type),
      schedule: (a, b) => compareStrings(scheduleLabel(a), scheduleLabel(b)),
      is_active: (a, b) => Number(b.is_active) - Number(a.is_active),
    },
  });

  const pageIds = useMemo(() => table.rows.map((row) => row.id), [table.rows]);
  const bulk = useBulkSelection(pageIds);

  const toolbarFilters = useMemo(
    () => [
      {
        id: "type",
        label: t("common.type"),
        value: table.filterValues.type ?? "",
        options: typeOptions,
        onChange: (v: string) => table.setFilter("type", v),
      },
      {
        id: "state",
        label: t("common.state"),
        value: table.filterValues.state ?? "",
        options: stateOptions,
        onChange: (v: string) => table.setFilter("state", v),
      },
    ],
    [table.filterValues, table.setFilter, typeOptions, stateOptions, t],
  );

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (s: Schedule) => {
    setEditing(s);
    setForm({
      scriptId: s.script_id,
      name: s.name,
      triggerType: s.trigger_type,
      cronExpression: s.cron_expression ?? "0 * * * *",
      intervalSeconds: s.interval_seconds ?? 3600,
      startAt: toDatetimeLocalValue(s.start_at),
      endAt: toDatetimeLocalValue(s.end_at),
      maxInstances: s.max_instances,
      maxRuntimeSeconds: s.max_runtime_seconds ? String(s.max_runtime_seconds) : "",
      isActive: s.is_active,
    });
    setOpen(true);
  };

  const closeModal = () => {
    setOpen(false);
    setEditing(null);
    setForm(emptyForm);
  };

  const formValid =
    form.name.trim() &&
    (editing || form.scriptId) &&
    (form.triggerType === "webhook" ||
      (form.triggerType === "cron" && form.cronExpression.trim()) ||
      (form.triggerType === "interval" && form.intervalSeconds > 0));

  const buildPayload = () => ({
    name: form.name.trim(),
    trigger_type: form.triggerType,
    cron_expression: form.triggerType === "cron" ? form.cronExpression.trim() : null,
    interval_seconds: form.triggerType === "interval" ? form.intervalSeconds : null,
    start_at: fromDatetimeLocalValue(form.startAt),
    end_at: fromDatetimeLocalValue(form.endAt),
    max_instances: form.maxInstances,
    max_runtime_seconds: form.maxRuntimeSeconds ? Number(form.maxRuntimeSeconds) : null,
    is_active: form.isActive,
  });

  const save = async () => {
    if (!formValid) return;
    setActionId(editing?.id ?? "new");
    try {
      if (editing) {
        await api(`/api/v1/schedules/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify(buildPayload()),
        });
      } else {
        await api(`/api/v1/schedules/scripts/${form.scriptId}`, {
          method: "POST",
          body: JSON.stringify(buildPayload()),
        });
      }
      closeModal();
      reload();
    } finally {
      setActionId(null);
    }
  };

  const remove = async (s: Schedule) => {
    if (!window.confirm(t("schedules.confirmDelete", { name: s.name }))) return;
    setActionId(s.id);
    try {
      await api(`/api/v1/schedules/${s.id}`, { method: "DELETE" });
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("schedules.deleteFailed"));
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
    if (!window.confirm(t("schedules.confirmBulkDelete", { count: bulk.count }))) return;
    try {
      await runBulk(bulk.selectedIds, (id) => api(`/api/v1/schedules/${id}`, { method: "DELETE" }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("schedules.deleteFailed"));
    }
  };

  const bulkSetActive = async (active: boolean) => {
    await runBulk(bulk.selectedIds, (id) =>
      api(`/api/v1/schedules/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: active }),
      }),
    );
  };

  const webhookUrl = editing?.webhook_token
    ? `${API_URL}/api/v1/hooks/${editing.webhook_token}`
    : null;

  return (
    <PageContainer>
      <PageHeader
        title={t("schedules.title")}
        subtitle={t("schedules.subtitle")}
        onRefresh={reload}
        refreshing={refreshing}
        lastUpdated={lastUpdated}
        action={
          canWrite ? (
            <Button icon={<PlusIcon className="size-4" />} onClick={openCreate}>
              {t("schedules.create")}
            </Button>
          ) : undefined
        }
      />

      <PageContent>
        <DataTableShell
          toolbar={
            <DataTableToolbar
              search={table.search}
              onSearchChange={table.setSearch}
              searchPlaceholder={t("schedules.searchPlaceholder")}
              filters={toolbarFilters}
              pageSize={table.pageSize}
              onPageSizeChange={table.setPageSize}
              showClear={table.hasActiveFilters}
              onClear={table.clearFilters}
            />
          }
          bulkBar={
            canWrite ? (
              <BulkActionsBar
                count={bulk.count}
                onClear={bulk.clear}
                busy={bulkBusy}
                actions={[
                  { id: "activate", label: t("common.activate"), onClick: () => bulkSetActive(true) },
                  { id: "deactivate", label: t("common.deactivate"), onClick: () => bulkSetActive(false) },
                  { id: "delete", label: t("common.delete"), variant: "danger", onClick: bulkDelete },
                ]}
              />
            ) : undefined
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
              {canWrite && (
                <TH align="center" className="w-10 px-3">
                  <SelectionCheckbox
                    checked={bulk.allSelected}
                    indeterminate={bulk.someSelected}
                    onChange={() => (bulk.allSelected ? bulk.clear() : bulk.selectAll())}
                    ariaLabel={t("common.selectAllOnPage")}
                  />
                </TH>
              )}
              <SortableTH label={t("common.name")} sortKey="name" sort={table.sort} onSort={table.toggleSort} className="w-[16%]" />
              <SortableTH label={t("common.script")} sortKey="script" sort={table.sort} onSort={table.toggleSort} className="w-[14%]" />
              <SortableTH label={t("common.type")} sortKey="trigger_type" sort={table.sort} onSort={table.toggleSort} className="w-[10%]" />
              <SortableTH label={t("common.schedule")} sortKey="schedule" sort={table.sort} onSort={table.toggleSort} className="w-[16%]" />
              <TH className="w-[18%]">{t("schedules.columns.window")}</TH>
              <TH className="w-[10%]">{t("schedules.columns.runtime")}</TH>
              <SortableTH label={t("common.state")} sortKey="is_active" sort={table.sort} onSort={table.toggleSort} className="w-[8%]" />
              {canWrite && (
                <TH align="right" className="w-[8%]">
                  {t("common.actions")}
                </TH>
              )}
            </THead>
            <TBody>
              {table.rows.map((s) => {
                const busy = actionId === s.id || bulkBusy;
                return (
                  <TR key={s.id} selected={bulk.isSelected(s.id)}>
                    {canWrite && (
                      <TD align="center" className="w-10 px-3">
                        <SelectionCheckbox
                          checked={bulk.isSelected(s.id)}
                          onChange={() => bulk.toggle(s.id)}
                          ariaLabel={t("common.selectItem", { name: s.name })}
                          disabled={bulkBusy}
                        />
                      </TD>
                    )}
                    <TD>
                      <span className="font-semibold text-foreground">{s.name}</span>
                      {s.max_instances > 1 && (
                        <p className="mt-0.5 text-xs text-faint">
                          {t("schedules.maxInstances", { count: s.max_instances })}
                        </p>
                      )}
                    </TD>
                    <TD>{scriptName(s.script_id)}</TD>
                    <TD>
                      <Badge label={s.trigger_type} tone="accent" />
                    </TD>
                    <TD className="font-mono text-xs">{scheduleLabel(s)}</TD>
                    <TD className="text-xs text-muted">{formatWindow(s)}</TD>
                    <TD className="text-xs">{formatRuntime(s.max_runtime_seconds)}</TD>
                    <TD>
                      <Badge
                        label={s.is_active ? t("common.active") : t("common.off")}
                        tone={s.is_active ? "success" : "neutral"}
                      />
                    </TD>
                    {canWrite && (
                      <TD align="right">
                        <div className="inline-flex items-center justify-end gap-1">
                          <IconButton
                            aria-label={t("schedules.edit")}
                            disabled={busy}
                            onClick={() => openEdit(s)}
                          >
                            <PencilSquareIcon className="size-4" />
                          </IconButton>
                          <IconButton
                            aria-label={t("common.deleteItem", { item: t("common.schedule") })}
                            disabled={busy}
                            onClick={() => remove(s)}
                            className="hover:text-red-400"
                          >
                            <TrashIcon className="size-4" />
                          </IconButton>
                        </div>
                      </TD>
                    )}
                  </TR>
                );
              })}
              {table.filteredCount === 0 && (
                <EmptyRow
                  colSpan={canWrite ? 9 : 7}
                  message={schedules.length ? t("schedules.emptyFiltered") : t("schedules.empty")}
                />
              )}
            </TBody>
          </Table>
        </DataTableShell>
      </PageContent>

      <Modal
        open={open}
        onClose={closeModal}
        title={editing ? t("schedules.edit") : t("schedules.create")}
        footer={
          <ModalActions
            onCancel={closeModal}
            onConfirm={save}
            confirmLabel={editing ? t("common.save") : t("common.create")}
            confirmDisabled={!formValid || actionId !== null}
          />
        }
      >
        <div className="space-y-4">
          {!editing && (
            <FieldGroup>
              <FieldLabel htmlFor="schedule-script">{t("common.script")}</FieldLabel>
              <Select
                id="schedule-script"
                value={form.scriptId}
                onChange={(e) => setForm((f) => ({ ...f, scriptId: e.target.value }))}
              >
                <option value="">{t("schedules.modal.selectScript")}</option>
                {scripts.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </FieldGroup>
          )}

          <FieldGroup>
            <FieldLabel htmlFor="schedule-name">{t("common.name")}</FieldLabel>
            <Input
              id="schedule-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder={t("schedules.modal.namePlaceholder")}
              autoFocus
            />
          </FieldGroup>

          <FieldGroup>
            <FieldLabel htmlFor="schedule-trigger">{t("schedules.modal.triggerType")}</FieldLabel>
            <Select
              id="schedule-trigger"
              value={form.triggerType}
              onChange={(e) => setForm((f) => ({ ...f, triggerType: e.target.value }))}
            >
              {triggerOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </FieldGroup>

          {form.triggerType === "cron" && (
            <FieldGroup>
              <FieldLabel htmlFor="schedule-cron">{t("backups.schedule.cron")}</FieldLabel>
              <Input
                id="schedule-cron"
                value={form.cronExpression}
                onChange={(e) => setForm((f) => ({ ...f, cronExpression: e.target.value }))}
                className="font-mono text-xs"
                placeholder="0 8 * * *"
              />
              <p className="text-xs text-faint">{t("schedules.modal.cronHint")}</p>
            </FieldGroup>
          )}

          {form.triggerType === "interval" && (
            <FieldGroup>
              <FieldLabel htmlFor="schedule-interval">{t("schedules.triggers.intervalDesc")}</FieldLabel>
              <Input
                id="schedule-interval"
                type="number"
                min={1}
                value={form.intervalSeconds}
                onChange={(e) => setForm((f) => ({ ...f, intervalSeconds: Number(e.target.value) || 0 }))}
              />
              <p className="text-xs text-faint">{t("schedules.modal.intervalHint")}</p>
            </FieldGroup>
          )}

          {form.triggerType === "webhook" && (
            <div className="rounded-lg bg-input px-3 py-2 text-xs text-muted ring-1 ring-ring-line">
              {webhookUrl ? (
                <>
                  <p className="mb-1 font-medium text-foreground-secondary">{t("schedules.modal.webhookUrl")}</p>
                  <p className="break-all font-mono text-cyan-400">{webhookUrl}</p>
                  <p className="mt-2">{t("schedules.modal.webhookPostHint")}</p>
                </>
              ) : (
                <p>{t("schedules.modal.webhookTokenHint")}</p>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FieldGroup>
              <FieldLabel htmlFor="schedule-start">{t("schedules.modal.activeFrom")}</FieldLabel>
              <Input
                id="schedule-start"
                type="datetime-local"
                value={form.startAt}
                onChange={(e) => setForm((f) => ({ ...f, startAt: e.target.value }))}
              />
            </FieldGroup>
            <FieldGroup>
              <FieldLabel htmlFor="schedule-end">{t("schedules.modal.activeUntil")}</FieldLabel>
              <Input
                id="schedule-end"
                type="datetime-local"
                value={form.endAt}
                onChange={(e) => setForm((f) => ({ ...f, endAt: e.target.value }))}
              />
            </FieldGroup>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FieldGroup>
              <FieldLabel htmlFor="schedule-instances">{t("schedules.modal.maxParallel")}</FieldLabel>
              <Input
                id="schedule-instances"
                type="number"
                min={1}
                value={form.maxInstances}
                onChange={(e) => setForm((f) => ({ ...f, maxInstances: Math.max(1, Number(e.target.value) || 1) }))}
              />
            </FieldGroup>
            <FieldGroup>
              <FieldLabel htmlFor="schedule-runtime">{t("schedules.modal.maxRuntime")}</FieldLabel>
              <Input
                id="schedule-runtime"
                type="number"
                min={1}
                value={form.maxRuntimeSeconds}
                onChange={(e) => setForm((f) => ({ ...f, maxRuntimeSeconds: e.target.value }))}
                placeholder={t("schedules.scriptDefault")}
              />
            </FieldGroup>
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground-secondary">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
              className="size-4 rounded border-line-strong bg-canvas text-cyan-400 focus:ring-cyan-400/50"
            />
            {t("schedules.modal.isActive")}
          </label>
        </div>
      </Modal>
    </PageContainer>
  );
}
