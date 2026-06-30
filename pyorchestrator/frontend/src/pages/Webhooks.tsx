import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowPathIcon,
  ClipboardDocumentIcon,
  PaperAirplaneIcon,
  PencilSquareIcon,
  PlusIcon,
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
import { FieldGroup, FieldLabel, Input, Select } from "@/components/ui/Input";
import Modal, { ModalActions } from "@/components/ui/Modal";
import Panel from "@/components/ui/Panel";
import { SelectionCheckbox } from "@/components/ui/SelectionCheckbox";
import { EmptyRow, Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { compareDates, compareStrings, useDataTable } from "@/hooks/useDataTable";
import { useBulkSelection } from "@/hooks/useBulkSelection";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { API_URL, api } from "@/api/client";
import { can, useAuth } from "@/context/AuthContext";
import { useTranslation } from "@/context/LocaleContext";
import { useToast } from "@/context/ToastContext";

interface WebhookRow {
  id: string;
  script_id: string;
  name: string;
  token: string;
  is_active: boolean;
  max_runtime_seconds: number | null;
  last_invoked_at: string | null;
}

interface Script {
  id: string;
  name: string;
}

const emptyForm = {
  scriptId: "",
  name: "",
  maxRuntimeSeconds: "",
  isActive: true,
};

function webhookUrl(token: string) {
  return `${API_URL}/api/v1/hooks/${token}`;
}

export default function WebhooksPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const { user } = useAuth();
  const canRead = can(user, "webhooks:read");
  const canWrite = can(user, "webhooks:write");
  const [scripts, setScripts] = useState<Script[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<WebhookRow | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const stateOptions = useMemo(
    () => [
      { value: "", label: t("webhooks.filters.all") },
      { value: "active", label: t("webhooks.filters.active") },
      { value: "inactive", label: t("webhooks.filters.inactive") },
    ],
    [t],
  );

  const fetchWebhooks = useCallback(() => api<WebhookRow[]>("/api/v1/webhooks"), []);
  const { data: webhooks = [], reload, refreshing, lastUpdated } = useLiveQuery(fetchWebhooks, [], {
    enabled: canRead,
  });

  useEffect(() => {
    if (canRead) {
      api<Script[]>("/api/v1/scripts").then(setScripts).catch(() => {});
    }
  }, [canRead]);

  const scriptName = useCallback(
    (id: string) => scripts.find((s) => s.id === id)?.name ?? id.slice(0, 8),
    [scripts],
  );

  const table = useDataTable({
    data: webhooks,
    defaultSort: { key: "name", dir: "asc" },
    searchFn: (row, q) =>
      row.name.toLowerCase().includes(q) ||
      row.token.toLowerCase().includes(q) ||
      scriptName(row.script_id).toLowerCase().includes(q),
    filters: [
      {
        id: "state",
        label: "State",
        options: stateOptions,
        predicate: (row, value) =>
          value === "active" ? row.is_active : value === "inactive" ? !row.is_active : true,
      },
    ],
    sortFns: {
      name: (a, b) => compareStrings(a.name, b.name),
      script: (a, b) => compareStrings(scriptName(a.script_id), scriptName(b.script_id)),
      is_active: (a, b) => Number(b.is_active) - Number(a.is_active),
      last_invoked_at: (a, b) => compareDates(a.last_invoked_at, b.last_invoked_at),
    },
  });

  const pageIds = useMemo(() => table.rows.map((row) => row.id), [table.rows]);
  const bulk = useBulkSelection(pageIds);

  const toolbarFilters = useMemo(
    () => [
      {
        id: "state",
        label: t("common.status"),
        value: table.filterValues.state ?? "",
        options: stateOptions,
        onChange: (v: string) => table.setFilter("state", v),
      },
    ],
    [table.filterValues, table.setFilter, stateOptions, t],
  );

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (wh: WebhookRow) => {
    setEditing(wh);
    setForm({
      scriptId: wh.script_id,
      name: wh.name,
      maxRuntimeSeconds: wh.max_runtime_seconds ? String(wh.max_runtime_seconds) : "",
      isActive: wh.is_active,
    });
    setOpen(true);
  };

  const closeModal = () => {
    setOpen(false);
    setEditing(null);
    setForm(emptyForm);
  };

  const formValid = form.name.trim() && (editing || form.scriptId);

  const save = async () => {
    if (!formValid) return;
    setActionId(editing?.id ?? "new");
    try {
      if (editing) {
        await api(`/api/v1/webhooks/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            name: form.name.trim(),
            is_active: form.isActive,
            max_runtime_seconds: form.maxRuntimeSeconds ? Number(form.maxRuntimeSeconds) : null,
          }),
        });
      } else {
        await api("/api/v1/webhooks", {
          method: "POST",
          body: JSON.stringify({
            script_id: form.scriptId,
            name: form.name.trim(),
            max_runtime_seconds: form.maxRuntimeSeconds ? Number(form.maxRuntimeSeconds) : null,
          }),
        });
      }
      closeModal();
      reload();
    } finally {
      setActionId(null);
    }
  };

  const remove = async (wh: WebhookRow) => {
    if (!window.confirm(t("webhooks.confirmDelete", { name: wh.name }))) return;
    setActionId(wh.id);
    try {
      await api(`/api/v1/webhooks/${wh.id}`, { method: "DELETE" });
      reload();
    } finally {
      setActionId(null);
    }
  };

  const regenerate = async (wh: WebhookRow) => {
    if (!window.confirm(t("webhooks.confirmRegenerate", { name: wh.name }))) return;
    setActionId(wh.id);
    try {
      await api(`/api/v1/webhooks/${wh.id}/regenerate-token`, { method: "POST" });
      reload();
    } finally {
      setActionId(null);
    }
  };

  const copyUrl = async (wh: WebhookRow) => {
    await navigator.clipboard.writeText(webhookUrl(wh.token));
    toast.success(t("webhooks.copied"));
  };

  const testWebhook = async (wh: WebhookRow) => {
    setActionId(wh.id);
    try {
      const res = await fetch(webhookUrl(wh.token), { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof data.detail === "string" ? data.detail : t("webhooks.invokeError"));
        return;
      }
      toast.success(t("webhooks.invokeQueued", { runId: data.run_id ?? "ok" }));
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
    if (!window.confirm(t("webhooks.confirmBulkDelete", { count: bulk.count }))) return;
    await runBulk(bulk.selectedIds, (id) => api(`/api/v1/webhooks/${id}`, { method: "DELETE" }));
  };

  const bulkSetActive = async (active: boolean) => {
    await runBulk(bulk.selectedIds, (id) =>
      api(`/api/v1/webhooks/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: active }),
      }),
    );
  };

  if (!canRead) {
    return (
      <PageContainer>
        <PageHeader title={t("webhooks.title")} subtitle={t("webhooks.restricted")} showRefresh={false} />
        <PageContent>
          <Panel>
            <p className="text-center text-sm text-muted">{t("common.insufficientPermissions")}</p>
          </Panel>
        </PageContent>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title={t("webhooks.title")}
        subtitle={t("webhooks.subtitle")}
        onRefresh={reload}
        refreshing={refreshing}
        lastUpdated={lastUpdated}
        action={
          canWrite ? (
            <Button icon={<PlusIcon className="size-4" />} onClick={openCreate}>
              {t("webhooks.create")}
            </Button>
          ) : undefined
        }
      />

      <PageContent>
        <Panel className="mb-6" bodyClassName="text-sm text-muted">
          {t("webhooks.hint")}
        </Panel>

        <DataTableShell
          toolbar={
            <DataTableToolbar
              search={table.search}
              onSearchChange={table.setSearch}
              searchPlaceholder={t("webhooks.searchPlaceholder")}
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
              <SortableTH label={t("common.name")} sortKey="name" sort={table.sort} onSort={table.toggleSort} className="w-[14%]" />
              <SortableTH label={t("webhooks.columns.script")} sortKey="script" sort={table.sort} onSort={table.toggleSort} className="w-[14%]" />
              <TH className="w-[32%]">{t("webhooks.columns.url")}</TH>
              <SortableTH label={t("common.status")} sortKey="is_active" sort={table.sort} onSort={table.toggleSort} className="w-[10%]" />
              <SortableTH
                label={t("webhooks.columns.lastInvoked")}
                sortKey="last_invoked_at"
                sort={table.sort}
                onSort={table.toggleSort}
                className="w-[14%]"
              />
              {canWrite && (
                <TH align="right" className="w-[14%]">
                  {t("common.actions")}
                </TH>
              )}
            </THead>
            <TBody>
              {table.rows.map((wh) => {
                const busy = actionId === wh.id || bulkBusy;
                const url = webhookUrl(wh.token);
                return (
                  <TR key={wh.id} selected={bulk.isSelected(wh.id)}>
                    {canWrite && (
                      <TD align="center" className="w-10 px-3">
                        <SelectionCheckbox
                          checked={bulk.isSelected(wh.id)}
                          onChange={() => bulk.toggle(wh.id)}
                          ariaLabel={wh.name}
                          disabled={bulkBusy}
                        />
                      </TD>
                    )}
                    <TD>
                      <span className="font-semibold text-foreground">{wh.name}</span>
                    </TD>
                    <TD>{scriptName(wh.script_id)}</TD>
                    <TD>
                      <code className="block truncate font-mono text-xs text-muted" title={url}>
                        {url}
                      </code>
                    </TD>
                    <TD>
                      <Badge
                        label={wh.is_active ? t("common.active") : t("common.inactive")}
                        tone={wh.is_active ? "success" : "neutral"}
                      />
                    </TD>
                    <TD className="text-xs text-muted">
                      {wh.last_invoked_at ? new Date(wh.last_invoked_at).toLocaleString() : "—"}
                    </TD>
                    {canWrite && (
                      <TD align="right">
                        <div className="inline-flex items-center justify-end gap-1">
                          <IconButton
                            aria-label={t("webhooks.copyUrl")}
                            disabled={busy}
                            onClick={() => copyUrl(wh)}
                            title={t("webhooks.copyUrl")}
                          >
                            <ClipboardDocumentIcon className="size-4" />
                          </IconButton>
                          <IconButton
                            aria-label={t("webhooks.test")}
                            disabled={busy || !wh.is_active}
                            onClick={() => testWebhook(wh)}
                            className={!wh.is_active ? "opacity-40" : undefined}
                          >
                            <PaperAirplaneIcon className="size-4" />
                          </IconButton>
                          <IconButton
                            aria-label={t("webhooks.regenerate")}
                            disabled={busy}
                            onClick={() => regenerate(wh)}
                          >
                            <ArrowPathIcon className="size-4" />
                          </IconButton>
                          <IconButton aria-label={t("webhooks.edit")} disabled={busy} onClick={() => openEdit(wh)}>
                            <PencilSquareIcon className="size-4" />
                          </IconButton>
                          <IconButton
                            aria-label={t("common.delete")}
                            disabled={busy}
                            onClick={() => remove(wh)}
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
                  colSpan={canWrite ? 7 : 5}
                  message={webhooks.length ? t("webhooks.emptyFiltered") : t("webhooks.empty")}
                />
              )}
            </TBody>
          </Table>
        </DataTableShell>
      </PageContent>

      <Modal
        open={open}
        onClose={closeModal}
        title={editing ? t("webhooks.modal.edit") : t("webhooks.modal.create")}
        footer={
          <ModalActions
            onCancel={closeModal}
            onConfirm={save}
            confirmLabel={editing ? t("common.save") : t("common.create")}
            confirmDisabled={!formValid}
          />
        }
      >
        <div className="space-y-4">
          <FieldGroup>
            <FieldLabel htmlFor="wh-name">{t("common.name")}</FieldLabel>
            <Input
              id="wh-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              autoFocus
            />
          </FieldGroup>
          {!editing && (
            <FieldGroup>
              <FieldLabel htmlFor="wh-script">{t("webhooks.modal.script")}</FieldLabel>
              <Select
                id="wh-script"
                value={form.scriptId}
                onChange={(e) => setForm({ ...form, scriptId: e.target.value })}
              >
                <option value="">{t("webhooks.modal.selectScript")}</option>
                {scripts.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </FieldGroup>
          )}
          <FieldGroup>
            <FieldLabel htmlFor="wh-runtime">{t("webhooks.modal.runtimeLimit")}</FieldLabel>
            <Input
              id="wh-runtime"
              type="number"
              min={1}
              value={form.maxRuntimeSeconds}
              onChange={(e) => setForm({ ...form, maxRuntimeSeconds: e.target.value })}
              placeholder={t("webhooks.modal.runtimePlaceholder")}
            />
          </FieldGroup>
          {editing && (
            <FieldGroup>
              <label className="flex items-center gap-2 text-sm text-foreground-secondary">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  className="size-4 rounded border-line-strong bg-input text-cyan-400"
                />
                {t("webhooks.modal.isActive")}
              </label>
            </FieldGroup>
          )}
          {editing && (
            <div className="rounded-lg bg-input px-3 py-2 ring-1 ring-ring-line">
              <p className="text-xs text-faint">{t("webhooks.columns.url")}</p>
              <p className="mt-1 break-all font-mono text-xs text-cyan-400">{webhookUrl(editing.token)}</p>
            </div>
          )}
        </div>
      </Modal>
    </PageContainer>
  );
}
