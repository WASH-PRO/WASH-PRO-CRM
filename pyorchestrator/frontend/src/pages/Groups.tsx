import { useCallback, useMemo, useState, type MouseEvent } from "react";
import {
  ArrowRightIcon,
  FolderIcon,
  PencilSquareIcon,
  PlusIcon,
  TrashIcon,
} from "@heroicons/react/20/solid";
import { useNavigate } from "react-router-dom";
import PageContainer, { PageContent } from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import Badge from "@/components/ui/Badge";
import BulkActionsBar from "@/components/ui/BulkActionsBar";
import Button, { IconButton } from "@/components/ui/Button";
import {
  DataTablePagination,
  DataTableShell,
  DataTableToolbar,
} from "@/components/ui/DataTable";
import { FieldGroup, FieldLabel, Input, Textarea } from "@/components/ui/Input";
import Modal, { ModalActions } from "@/components/ui/Modal";
import { SelectionCheckbox } from "@/components/ui/SelectionCheckbox";
import { EmptyRow, Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { compareStrings, useDataTable } from "@/hooks/useDataTable";
import { useBulkSelection } from "@/hooks/useBulkSelection";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { cn } from "@/lib/cn";
import { api } from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import { useTranslation } from "@/context/LocaleContext";

interface Group {
  id: string;
  name: string;
  description: string;
  color: string;
  icon: string;
}

interface ScriptRef {
  id: string;
  group_id: string | null;
}

function groupInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function GroupAvatar({ name, color }: { name: string; color: string }) {
  return (
    <div
      className="flex size-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold shadow-sm ring-1 ring-inset ring-black/10"
      style={{
        backgroundColor: color,
        color: "#09090b",
      }}
    >
      {groupInitials(name)}
    </div>
  );
}

export default function GroupsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === "Administrator";
  const [actionId, setActionId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [modalGroup, setModalGroup] = useState<Group | "new" | null>(null);
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formColor, setFormColor] = useState("#5c6bc0");

  const isCreateModal = modalGroup === "new";
  const editingGroup = modalGroup !== null && modalGroup !== "new" ? modalGroup : null;

  const fetchPageData = useCallback(
    () =>
      Promise.all([
        api<Group[]>("/api/v1/groups"),
        api<ScriptRef[]>("/api/v1/scripts"),
      ]),
    [],
  );

  const { data, reload, refreshing, lastUpdated } = useLiveQuery(fetchPageData, []);
  const groups = data?.[0] ?? [];
  const scripts = data?.[1] ?? [];

  const scriptCountByGroup = useMemo(() => {
    const counts = new Map<string, number>();
    for (const script of scripts) {
      if (!script.group_id) continue;
      counts.set(script.group_id, (counts.get(script.group_id) ?? 0) + 1);
    }
    return counts;
  }, [scripts]);

  const table = useDataTable({
    data: groups,
    defaultSort: { key: "name", dir: "asc" },
    pageSize: 12,
    searchFn: (row, q) =>
      row.name.toLowerCase().includes(q) || row.description.toLowerCase().includes(q),
    sortFns: {
      name: (a, b) => compareStrings(a.name, b.name),
    },
  });

  const pageIds = useMemo(() => table.rows.map((row) => row.id), [table.rows]);
  const bulk = useBulkSelection(pageIds);

  const resetForm = () => {
    setFormName("");
    setFormDescription("");
    setFormColor("#5c6bc0");
  };

  const openCreate = () => {
    resetForm();
    setModalGroup("new");
  };

  const openEdit = (g: Group, e?: MouseEvent) => {
    e?.stopPropagation();
    setModalGroup(g);
    setFormName(g.name);
    setFormDescription(g.description);
    setFormColor(g.color);
  };

  const closeModal = () => {
    setModalGroup(null);
    resetForm();
  };

  const saveForm = async () => {
    if (!formName.trim()) return;
    setActionId(isCreateModal ? "new" : editingGroup!.id);
    try {
      const payload = {
        name: formName.trim(),
        description: formDescription,
        color: formColor,
      };
      if (isCreateModal) {
        await api("/api/v1/groups", { method: "POST", body: JSON.stringify(payload) });
      } else {
        await api(`/api/v1/groups/${editingGroup!.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      }
      closeModal();
      reload();
    } finally {
      setActionId(null);
    }
  };

  const remove = async (g: Group, e?: MouseEvent) => {
    e?.stopPropagation();
    if (!window.confirm(t("groups.confirmDelete", { name: g.name }))) {
      return;
    }
    setActionId(g.id);
    try {
      await api(`/api/v1/groups/${g.id}`, { method: "DELETE" });
      reload();
    } finally {
      setActionId(null);
    }
  };

  const bulkDelete = async () => {
    if (!window.confirm(t("groups.confirmBulkDelete", { count: bulk.count }))) {
      return;
    }
    setBulkBusy(true);
    try {
      for (const id of bulk.selectedIds) {
        await api(`/api/v1/groups/${id}`, { method: "DELETE" });
      }
      bulk.clear();
      reload();
    } finally {
      setBulkBusy(false);
    }
  };

  const colSpan = 3;

  return (
    <PageContainer>
      <PageHeader
        title={t("groups.title")}
        subtitle={t("groups.subtitle")}
        onRefresh={reload}
        refreshing={refreshing}
        lastUpdated={lastUpdated}
        action={
          isAdmin ? (
            <Button icon={<PlusIcon className="size-4" />} onClick={openCreate}>
              {t("groups.create")}
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
              searchPlaceholder={t("groups.searchPlaceholder")}
              pageSize={table.pageSize}
              onPageSizeChange={table.setPageSize}
              showClear={table.hasActiveFilters}
              onClear={table.clearFilters}
            />
          }
          bulkBar={
            isAdmin ? (
              <BulkActionsBar
                count={bulk.count}
                onClear={bulk.clear}
                busy={bulkBusy}
                actions={[{ id: "delete", label: t("common.delete"), variant: "danger", onClick: bulkDelete }]}
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
              <TH>
                <div className="flex items-center gap-3">
                  {isAdmin && (
                    <SelectionCheckbox
                      checked={bulk.allSelected}
                      indeterminate={bulk.someSelected}
                      onChange={() => (bulk.allSelected ? bulk.clear() : bulk.selectAll())}
                      ariaLabel={t("common.selectAllOnPage")}
                      disabled={bulkBusy}
                    />
                  )}
                  <span>{t("groups.columns.group")}</span>
                </div>
              </TH>
              <TH className="w-36">{t("groups.columns.scripts")}</TH>
              <TH align="right" className="w-48">
                {isAdmin ? t("common.actions") : ""}
              </TH>
            </THead>
            <TBody>
              {table.rows.map((g) => {
                const busy = actionId === g.id || bulkBusy;
                const count = scriptCountByGroup.get(g.id) ?? 0;
                return (
                  <TR
                    key={g.id}
                    selected={bulk.isSelected(g.id)}
                    onClick={() => navigate(`/scripts?group=${g.id}`)}
                    className="group/row"
                  >
                    <TD>
                      <div className="flex min-w-0 items-center gap-3">
                        {isAdmin && (
                          <div className="shrink-0" onClick={(e: MouseEvent) => e.stopPropagation()}>
                            <SelectionCheckbox
                              checked={bulk.isSelected(g.id)}
                              onChange={() => bulk.toggle(g.id)}
                              ariaLabel={t("common.selectItem", { name: g.name })}
                              disabled={bulkBusy}
                            />
                          </div>
                        )}
                        <GroupAvatar name={g.name} color={g.color} />
                        <div
                          className="min-w-0 flex-1 border-l-[3px] pl-3"
                          style={{ borderLeftColor: g.color }}
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <FolderIcon className="size-4 shrink-0 text-faint" aria-hidden />
                            <p className="truncate font-semibold text-foreground group-hover/row:text-cyan-400">
                              {g.name}
                            </p>
                          </div>
                          {g.description ? (
                            <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted">{g.description}</p>
                          ) : (
                            <p className="mt-1 text-sm text-dim">—</p>
                          )}
                        </div>
                      </div>
                    </TD>
                    <TD>
                      <Badge
                        label={t("groups.scriptCount", { count })}
                        tone={count > 0 ? "accent" : "neutral"}
                      />
                    </TD>
                    <TD align="right">
                      <div
                        className="inline-flex items-center justify-end gap-1"
                        onClick={(e: MouseEvent) => e.stopPropagation()}
                      >
                        {isAdmin && (
                          <div className="mr-1 flex items-center gap-1 opacity-0 transition-opacity group-hover/row:opacity-100">
                            <IconButton aria-label={t("groups.edit")} disabled={busy} onClick={(e) => openEdit(g, e)}>
                              <PencilSquareIcon className="size-4" />
                            </IconButton>
                            <IconButton
                              aria-label={t("common.deleteItem", { item: t("common.group") })}
                              disabled={busy}
                              onClick={(e) => remove(g, e)}
                              className="hover:text-red-400"
                            >
                              <TrashIcon className="size-4" />
                            </IconButton>
                          </div>
                        )}
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-muted",
                            "transition-colors group-hover/row:bg-cyan-400/10 group-hover/row:text-cyan-400",
                          )}
                        >
                          {t("common.viewScripts")}
                          <ArrowRightIcon className="size-3.5" />
                        </span>
                      </div>
                    </TD>
                  </TR>
                );
              })}
              {table.filteredCount === 0 && (
                <EmptyRow
                  colSpan={colSpan}
                  message={groups.length ? t("groups.emptyFiltered") : t("groups.empty")}
                />
              )}
            </TBody>
          </Table>
        </DataTableShell>
      </PageContent>

      <Modal
        open={modalGroup !== null}
        onClose={closeModal}
        title={isCreateModal ? t("groups.create") : t("groups.edit")}
        footer={
          <ModalActions
            onCancel={closeModal}
            onConfirm={saveForm}
            confirmLabel={isCreateModal ? t("common.create") : t("common.save")}
            confirmDisabled={!formName.trim() || actionId !== null}
          />
        }
      >
        <div className="space-y-4">
          <FieldGroup>
            <FieldLabel htmlFor="group-name">{t("common.name")}</FieldLabel>
            <Input
              id="group-name"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              autoFocus
            />
          </FieldGroup>
          <FieldGroup>
            <FieldLabel htmlFor="group-description">{t("common.description")}</FieldLabel>
            <Textarea
              id="group-description"
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              rows={3}
            />
          </FieldGroup>
          <FieldGroup>
            <FieldLabel htmlFor="group-color">{t("common.color")}</FieldLabel>
            <div className="flex items-center gap-3">
              <GroupAvatar name={formName.trim() || "GR"} color={formColor} />
              <input
                id="group-color"
                type="color"
                value={formColor}
                onChange={(e) => setFormColor(e.target.value)}
                className="size-10 cursor-pointer rounded-md border-0 bg-transparent p-0"
              />
              <Input
                value={formColor}
                onChange={(e) => setFormColor(e.target.value)}
                className="font-mono text-xs"
              />
            </div>
          </FieldGroup>
        </div>
      </Modal>
    </PageContainer>
  );
}
