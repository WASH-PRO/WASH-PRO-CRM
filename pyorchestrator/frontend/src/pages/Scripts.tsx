import { useCallback, useEffect, useMemo, useState } from "react";
import { PlusIcon } from "@heroicons/react/20/solid";
import { useNavigate, useSearchParams } from "react-router-dom";
import PageContainer, { PageContent } from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import Badge from "@/components/ui/Badge";
import BulkActionsBar from "@/components/ui/BulkActionsBar";
import Button from "@/components/ui/Button";
import { DataTablePagination, DataTableToolbar } from "@/components/ui/DataTable";
import { FieldGroup, FieldLabel, Input, Select } from "@/components/ui/Input";
import Modal, { ModalActions } from "@/components/ui/Modal";
import Panel from "@/components/ui/Panel";
import ScriptCard, { type ScriptCardData } from "@/components/ui/ScriptCard";
import { SelectionCheckbox } from "@/components/ui/SelectionCheckbox";
import { compareStrings, useDataTable } from "@/hooks/useDataTable";
import { useBulkSelection } from "@/hooks/useBulkSelection";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { api } from "@/api/client";
import { can, useAuth } from "@/context/AuthContext";
import { useTranslation } from "@/context/LocaleContext";
import { useToast } from "@/context/ToastContext";

interface Group {
  id: string;
  name: string;
  color: string;
}

interface Template {
  id: string;
  name: string;
}

export default function ScriptsPage() {
  const { t } = useTranslation();
  const typeOptions = useMemo(
    () => [
      { value: "", label: t("filters.allTypes") },
      { value: "script", label: t("common.script") },
      { value: "bot", label: t("common.bot") },
    ],
    [t],
  );
  const statusOptions = useMemo(
    () => [
      { value: "", label: t("filters.allStatuses") },
      { value: "enabled", label: t("common.enabled") },
      { value: "disabled", label: t("common.disabled") },
      { value: "draft", label: t("common.draft") },
    ],
    [t],
  );
  const [searchParams, setSearchParams] = useSearchParams();
  const groupFromUrl = searchParams.get("group") ?? "";

  const [groups, setGroups] = useState<Group[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [open, setOpen] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [name, setName] = useState("");
  const [groupId, setGroupId] = useState("");
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const canRun = can(user, "scripts:run");
  const canDelete = can(user, "scripts:delete");
  const canBulk = canRun || canDelete;

  const fetchScripts = useCallback(() => api<ScriptCardData[]>("/api/v1/scripts"), []);
  const { data: scripts = [], reload, refreshing, lastUpdated } = useLiveQuery(fetchScripts, []);

  useEffect(() => {
    api<Group[]>("/api/v1/groups").then(setGroups).catch(() => {});
    api<Template[]>("/api/v1/scripts/templates").then(setTemplates).catch(() => {});
  }, []);

  const groupById = useMemo(() => new Map(groups.map((g) => [g.id, g])), [groups]);

  const groupFilterOptions = useMemo(
    () => [
      { value: "", label: t("filters.allGroups") },
      ...groups.map((g) => ({ value: g.id, label: g.name })),
    ],
    [groups, t],
  );

  const tableFilters = useMemo(
    () => [
      {
        id: "group",
        label: t("common.group"),
        options: groupFilterOptions,
        predicate: (row: ScriptCardData, value: string) => row.group_id === value,
      },
      {
        id: "type",
        label: t("common.type"),
        options: typeOptions,
        predicate: (row: ScriptCardData, value: string) => row.script_type === value,
      },
      {
        id: "status",
        label: t("common.status"),
        options: statusOptions,
        predicate: (row: ScriptCardData, value: string) => row.status === value,
      },
    ],
    [groupFilterOptions, typeOptions, statusOptions, t],
  );

  const table = useDataTable({
    data: scripts,
    defaultSort: { key: "name", dir: "asc" },
    pageSize: 12,
    initialFilterValues: groupFromUrl ? { group: groupFromUrl } : undefined,
    searchFn: (row, q) =>
      row.name.toLowerCase().includes(q) ||
      row.slug.toLowerCase().includes(q) ||
      row.description.toLowerCase().includes(q),
    filters: tableFilters,
    sortFns: {
      name: (a, b) => compareStrings(a.name, b.name),
      script_type: (a, b) => compareStrings(a.script_type, b.script_type),
      status: (a, b) => compareStrings(a.status, b.status),
    },
  });

  const pageIds = useMemo(() => table.rows.map((row) => row.id), [table.rows]);
  const bulk = useBulkSelection(pageIds);

  useEffect(() => {
    table.setFilter("group", groupFromUrl);
  }, [groupFromUrl, table.setFilter]);

  const setGroupFilter = useCallback(
    (value: string) => {
      table.setFilter("group", value);
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (value) next.set("group", value);
          else next.delete("group");
          return next;
        },
        { replace: true },
      );
    },
    [table.setFilter, setSearchParams],
  );

  const clearAllFilters = useCallback(() => {
    table.clearFilters();
    setSearchParams({}, { replace: true });
  }, [table.clearFilters, setSearchParams]);

  const activeGroup = groups.find((g) => g.id === (table.filterValues.group || groupFromUrl));

  const toolbarFilters = useMemo(
    () => [
      {
        id: "group",
        label: t("common.group"),
        value: table.filterValues.group ?? "",
        options: groupFilterOptions,
        onChange: setGroupFilter,
      },
      {
        id: "type",
        label: t("common.type"),
        value: table.filterValues.type ?? "",
        options: typeOptions,
        onChange: (v: string) => table.setFilter("type", v),
      },
      {
        id: "status",
        label: t("common.status"),
        value: table.filterValues.status ?? "",
        options: statusOptions,
        onChange: (v: string) => table.setFilter("status", v),
      },
    ],
    [table.filterValues, table.setFilter, groupFilterOptions, setGroupFilter, typeOptions, statusOptions, t],
  );

  const create = async () => {
    await api("/api/v1/scripts", { method: "POST", body: JSON.stringify({ name, group_id: groupId || null }) });
    setOpen(false);
    setName("");
    reload();
  };

  const run = async (id: string) => {
    await api(`/api/v1/runs/scripts/${id}/run`, { method: "POST" });
    reload();
  };

  const stop = async (id: string) => {
    setActionId(id);
    try {
      await api(`/api/v1/runs/scripts/${id}/stop`, { method: "POST" });
      reload();
    } finally {
      setActionId(null);
    }
  };

  const remove = async (s: ScriptCardData) => {
    if (!window.confirm(t("scripts.confirmDelete", { name: s.name }))) {
      return;
    }
    setActionId(s.id);
    try {
      await api(`/api/v1/scripts/${s.id}`, { method: "DELETE" });
      toast.success(t("scripts.deleted", { name: s.name }));
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("scripts.deleteFailed"));
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
    if (!window.confirm(t("scripts.confirmBulkDelete", { count: bulk.count }))) return;
    await runBulk(bulk.selectedIds, (id) => api(`/api/v1/scripts/${id}`, { method: "DELETE" }));
  };

  const bulkRun = async () => {
    await runBulk(bulk.selectedIds, (id) =>
      api(`/api/v1/runs/scripts/${id}/run`, { method: "POST" }),
    );
  };

  const emptyMessage = scripts.length
    ? activeGroup
      ? t("scripts.emptyGroup", { name: activeGroup.name })
      : t("scripts.emptyFiltered")
    : t("scripts.empty");

  return (
    <PageContainer>
      <PageHeader
        title={t("scripts.title")}
        subtitle={activeGroup ? t("scripts.subtitleGroup", { name: activeGroup.name }) : t("scripts.subtitle")}
        onRefresh={reload}
        refreshing={refreshing}
        lastUpdated={lastUpdated}
        action={
          can(user, "scripts:write") ? (
            <Button icon={<PlusIcon className="size-4" />} onClick={() => setOpen(true)}>
              {t("scripts.create")}
            </Button>
          ) : undefined
        }
      />

      <PageContent>
        {activeGroup && (
          <div className="flex items-center gap-2">
            <Badge label={activeGroup.name} tone="accent" />
            <button
              type="button"
              onClick={() => setGroupFilter("")}
              className="text-xs text-faint transition-colors hover:text-foreground-secondary"
            >
              {t("scripts.clearGroupFilter")}
            </button>
          </div>
        )}

        <div className="overflow-hidden rounded-xl bg-panel-muted ring-1 ring-ring-line">
          <DataTableToolbar
            search={table.search}
            onSearchChange={table.setSearch}
            searchPlaceholder={t("scripts.searchPlaceholder")}
            filters={toolbarFilters}
            pageSize={table.pageSize}
            onPageSizeChange={table.setPageSize}
            showClear={table.hasActiveFilters || !!groupFromUrl}
            onClear={clearAllFilters}
          />

          {canBulk && table.filteredCount > 0 && (
            <>
              <div className="flex items-center gap-2 border-b border-line px-4 py-2 lg:px-5">
                <SelectionCheckbox
                  checked={bulk.allSelected}
                  indeterminate={bulk.someSelected}
                  onChange={() => (bulk.allSelected ? bulk.clear() : bulk.selectAll())}
                  ariaLabel={t("common.selectAllOnPage")}
                  disabled={bulkBusy}
                />
                <span className="text-xs text-muted">{t("common.selectAllOnPage")}</span>
              </div>
              <BulkActionsBar
                count={bulk.count}
                onClear={bulk.clear}
                busy={bulkBusy}
                actions={[
                  ...(canRun ? [{ id: "run", label: t("common.run"), onClick: bulkRun }] : []),
                  ...(canDelete
                    ? [{ id: "delete", label: t("common.delete"), variant: "danger" as const, onClick: bulkDelete }]
                    : []),
                ]}
              />
            </>
          )}

          <div className="grid auto-rows-fr grid-cols-1 gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {table.rows.map((s) => {
              const group = s.group_id ? groupById.get(s.group_id) : undefined;
              return (
                <ScriptCard
                  key={s.id}
                  script={s}
                  groupName={group?.name}
                  groupColor={group?.color}
                  busy={actionId === s.id || bulkBusy}
                  canRun={canRun}
                  canDelete={canDelete}
                  selectable={canBulk}
                  selected={bulk.isSelected(s.id)}
                  onToggleSelect={() => bulk.toggle(s.id)}
                  onOpen={() => navigate(`/scripts/${s.id}`)}
                  onRun={() => run(s.id)}
                  onStop={() => stop(s.id)}
                  onDelete={() => remove(s)}
                />
              );
            })}
            {table.filteredCount === 0 && (
              <Panel className="sm:col-span-2 xl:col-span-3 2xl:col-span-4">
                <p className="py-12 text-center text-sm text-faint">{emptyMessage}</p>
              </Panel>
            )}
          </div>

          {table.filteredCount > 0 && (
            <DataTablePagination
              page={table.page}
              totalPages={table.totalPages}
              rangeStart={table.rangeStart}
              rangeEnd={table.rangeEnd}
              filteredCount={table.filteredCount}
              totalCount={table.totalCount}
              onPageChange={table.setPage}
            />
          )}
        </div>
      </PageContent>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t("scripts.modalCreate")}
        footer={<ModalActions onCancel={() => setOpen(false)} onConfirm={create} confirmLabel={t("common.create")} confirmDisabled={!name} />}
      >
        <div className="space-y-4">
          <FieldGroup>
            <FieldLabel htmlFor="script-name">{t("common.name")}</FieldLabel>
            <Input id="script-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </FieldGroup>
          <FieldGroup>
            <FieldLabel htmlFor="script-group">{t("common.group")}</FieldLabel>
            <Select
              id="script-group"
              value={groupId || groupFromUrl}
              onChange={(e) => setGroupId(e.target.value)}
            >
              <option value="">{t("common.none")}</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </Select>
          </FieldGroup>
          {templates.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-faint">{t("common.fromTemplate")}</p>
              <div className="flex flex-wrap gap-2">
                {templates.map((t) => (
                  <Button
                    key={t.id}
                    size="sm"
                    variant="secondary"
                    onClick={async () => {
                      await api(`/api/v1/scripts/from-template/${t.id}`, { method: "POST" });
                      setOpen(false);
                      reload();
                    }}
                  >
                    {t.name}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
      </Modal>
    </PageContainer>
  );
}
