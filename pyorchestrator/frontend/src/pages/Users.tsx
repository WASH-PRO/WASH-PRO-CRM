import { useCallback, useMemo, useState } from "react";
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
import Panel from "@/components/ui/Panel";
import { SelectionCheckbox } from "@/components/ui/SelectionCheckbox";
import { EmptyRow, Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { compareStrings, useDataTable } from "@/hooks/useDataTable";
import { useBulkSelection } from "@/hooks/useBulkSelection";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { api } from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import { useTranslation } from "@/context/LocaleContext";
import { cn } from "@/lib/cn";
import { permissionLabel } from "@/lib/permissions";

interface UserRow {
  id: string;
  email: string;
  display_name: string;
  role: string;
  is_active: boolean;
}

interface RoleInfo {
  name: string;
  permissions: string[];
}

interface PermissionCatalog {
  permissions: string[];
  roles: RoleInfo[];
}

const ROLE_VALUES = ["Administrator", "Developer", "Operator", "Viewer"] as const;

const emptyForm = {
  email: "",
  password: "",
  displayName: "",
  role: "Viewer",
  isActive: true,
};

function roleTone(role: string): "accent" | "success" | "warning" | "neutral" {
  if (role === "Administrator") return "accent";
  if (role === "Developer") return "success";
  if (role === "Operator") return "warning";
  return "neutral";
}

export default function UsersPage() {
  const { t } = useTranslation();
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === "Administrator";
  const [tab, setTab] = useState<"users" | "roles">("users");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [form, setForm] = useState({
    email: "",
    password: "",
    displayName: "",
    role: "Viewer",
    isActive: true,
  });

  const roleOptions = useMemo(
    () =>
      ROLE_VALUES.map((value) => ({
        value,
        label: t(`users.roles.${value}` as "users.roles.Administrator"),
      })),
    [t],
  );

  const roleFilterOptions = useMemo(
    () => [{ value: "", label: t("filters.allRoles") }, ...roleOptions],
    [roleOptions, t],
  );

  const stateOptions = useMemo(
    () => [
      { value: "", label: t("filters.allStates") },
      { value: "active", label: t("common.active") },
      { value: "inactive", label: t("common.inactive") },
    ],
    [t],
  );

  const fetchUsers = useCallback(() => api<UserRow[]>("/api/v1/users"), []);
  const fetchRoles = useCallback(() => api<PermissionCatalog>("/api/v1/roles"), []);

  const { data: users = [], reload, refreshing, lastUpdated } = useLiveQuery(fetchUsers, [], {
    enabled: isAdmin,
  });
  const { data: catalog } = useLiveQuery(fetchRoles, [], { enabled: isAdmin });

  const table = useDataTable({
    data: users,
    defaultSort: { key: "email", dir: "asc" },
    searchFn: (row, q) =>
      row.email.toLowerCase().includes(q) ||
      row.display_name.toLowerCase().includes(q) ||
      row.role.toLowerCase().includes(q),
    filters: [
      {
        id: "role",
        label: t("common.role"),
        options: roleFilterOptions,
        predicate: (row, value) => row.role === value,
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
      email: (a, b) => compareStrings(a.email, b.email),
      display_name: (a, b) => compareStrings(a.display_name, b.display_name),
      role: (a, b) => compareStrings(a.role, b.role),
      is_active: (a, b) => Number(b.is_active) - Number(a.is_active),
    },
  });

  const pageIds = useMemo(() => table.rows.map((row) => row.id), [table.rows]);
  const bulk = useBulkSelection(pageIds);

  const toolbarFilters = useMemo(
    () => [
      {
        id: "role",
        label: t("common.role"),
        value: table.filterValues.role ?? "",
        options: roleFilterOptions,
        onChange: (v: string) => table.setFilter("role", v),
      },
      {
        id: "state",
        label: t("common.state"),
        value: table.filterValues.state ?? "",
        options: stateOptions,
        onChange: (v: string) => table.setFilter("state", v),
      },
    ],
    [table.filterValues, table.setFilter, roleFilterOptions, stateOptions, t],
  );

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (u: UserRow) => {
    setEditing(u);
    setForm({
      email: u.email,
      password: "",
      displayName: u.display_name,
      role: u.role,
      isActive: u.is_active,
    });
    setOpen(true);
  };

  const closeModal = () => {
    setOpen(false);
    setEditing(null);
    setForm(emptyForm);
  };

  const formValid =
    form.email.trim() &&
    (editing ? true : form.password.length >= 6) &&
    (!form.password || form.password.length >= 6);

  const save = async () => {
    if (!formValid) return;
    setActionId(editing?.id ?? "new");
    try {
      if (editing) {
        const payload: Record<string, unknown> = {
          email: form.email.trim(),
          display_name: form.displayName.trim(),
          role: form.role,
          is_active: form.isActive,
        };
        if (form.password) payload.password = form.password;
        await api(`/api/v1/users/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        await api("/api/v1/users", {
          method: "POST",
          body: JSON.stringify({
            email: form.email.trim(),
            password: form.password,
            display_name: form.displayName.trim(),
            role: form.role,
          }),
        });
      }
      closeModal();
      reload();
    } finally {
      setActionId(null);
    }
  };

  const remove = async (u: UserRow) => {
    if (!window.confirm(t("users.confirmDelete", { email: u.email }))) return;
    setActionId(u.id);
    try {
      await api(`/api/v1/users/${u.id}`, { method: "DELETE" });
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
    if (!window.confirm(t("users.confirmBulkDelete", { count: bulk.count }))) return;
    await runBulk(bulk.selectedIds, (id) => api(`/api/v1/users/${id}`, { method: "DELETE" }));
  };

  const bulkSetActive = async (active: boolean) => {
    await runBulk(bulk.selectedIds, (id) =>
      api(`/api/v1/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: active }),
      }),
    );
  };

  if (!isAdmin) {
    return (
      <PageContainer>
        <PageHeader title={t("users.title")} subtitle={t("users.subtitle")} showRefresh={false} />
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
        title={t("users.titleFull")}
        subtitle={t("users.subtitle")}
        onRefresh={reload}
        refreshing={refreshing}
        lastUpdated={lastUpdated}
        action={
          tab === "users" ? (
            <Button icon={<PlusIcon className="size-4" />} onClick={openCreate}>
              {t("users.create")}
            </Button>
          ) : undefined
        }
      />

      <PageContent>
        <div className="mb-4 flex gap-2">
          {(
            [
              { id: "users" as const, label: t("users.tabs.users") },
              { id: "roles" as const, label: t("users.tabs.roles") },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                tab === item.id
                  ? "bg-cyan-400/10 text-cyan-400 ring-1 ring-inset ring-cyan-400/20"
                  : "text-muted hover:bg-hover hover:text-foreground-secondary",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        {tab === "users" ? (
          <DataTableShell
            toolbar={
              <DataTableToolbar
                search={table.search}
                onSearchChange={table.setSearch}
                searchPlaceholder={t("users.searchPlaceholder")}
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
                  { id: "activate", label: t("common.activate"), onClick: () => bulkSetActive(true) },
                  { id: "deactivate", label: t("common.deactivate"), onClick: () => bulkSetActive(false) },
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
                <SortableTH label={t("common.email")} sortKey="email" sort={table.sort} onSort={table.toggleSort} className="w-[28%]" />
                <SortableTH label={t("common.name")} sortKey="display_name" sort={table.sort} onSort={table.toggleSort} className="w-[22%]" />
                <SortableTH label={t("common.role")} sortKey="role" sort={table.sort} onSort={table.toggleSort} className="w-[18%]" />
                <SortableTH label={t("common.state")} sortKey="is_active" sort={table.sort} onSort={table.toggleSort} className="w-[12%]" />
                <TH align="right" className="w-[12%]">
                  {t("common.actions")}
                </TH>
              </THead>
              <TBody>
                {table.rows.map((u) => {
                  const busy = actionId === u.id || bulkBusy;
                  const isSelf = u.id === currentUser?.id;
                  return (
                    <TR key={u.id} selected={bulk.isSelected(u.id)}>
                      <TD align="center" className="w-10 px-3">
                        <SelectionCheckbox
                          checked={bulk.isSelected(u.id)}
                          onChange={() => bulk.toggle(u.id)}
                          ariaLabel={t("common.selectItem", { name: u.email })}
                          disabled={bulkBusy}
                        />
                      </TD>
                      <TD>
                        <span className="font-medium text-foreground">{u.email}</span>
                        {isSelf && <p className="mt-0.5 text-xs text-faint">{t("common.you")}</p>}
                      </TD>
                      <TD>{u.display_name || "—"}</TD>
                      <TD>
                        <Badge label={u.role} tone={roleTone(u.role)} />
                      </TD>
                      <TD>
                        <Badge
                          label={u.is_active ? t("common.active") : t("common.disabled")}
                          tone={u.is_active ? "success" : "neutral"}
                        />
                      </TD>
                      <TD align="right">
                        <div className="inline-flex items-center justify-end gap-1">
                          <IconButton aria-label={t("users.edit")} disabled={busy} onClick={() => openEdit(u)}>
                            <PencilSquareIcon className="size-4" />
                          </IconButton>
                          <IconButton
                            aria-label={t("common.deleteItem", { item: t("users.title") })}
                            disabled={busy || isSelf}
                            onClick={() => remove(u)}
                            className={isSelf ? "opacity-40" : "hover:text-red-400"}
                          >
                            <TrashIcon className="size-4" />
                          </IconButton>
                        </div>
                      </TD>
                    </TR>
                  );
                })}
                {table.filteredCount === 0 && (
                  <EmptyRow colSpan={6} message={users.length ? t("users.emptyFiltered") : t("users.empty")} />
                )}
              </TBody>
            </Table>
          </DataTableShell>
        ) : (
          <Panel title={t("users.rolesPanel.title")} subtitle={t("users.rolesPanel.subtitle")}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-xs font-semibold uppercase tracking-wider text-faint">
                    <th className="px-4 py-3">{t("common.permission")}</th>
                    {(catalog?.roles ?? roleOptions.map((r) => ({ name: r.value, permissions: [] as string[] }))).map(
                      (role) => (
                        <th key={role.name} className="px-4 py-3 text-center">
                          {t(`users.roles.${role.name}` as "users.roles.Administrator")}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {(catalog?.permissions ?? []).map((perm) => (
                    <tr key={perm} className="border-b border-line/60">
                      <td className="px-4 py-2.5">
                        <span className="font-mono text-xs text-muted">{perm}</span>
                        <p className="mt-0.5 text-xs text-faint">{permissionLabel(t, perm)}</p>
                      </td>
                      {(catalog?.roles ?? []).map((role) => {
                        const allowed = role.permissions.includes("*") || role.permissions.includes(perm);
                        return (
                          <td key={role.name} className="px-4 py-2.5 text-center">
                            {allowed ? (
                              <span className="inline-block size-2 rounded-full bg-emerald-400" title={t("common.allowed")} />
                            ) : (
                              <span className="text-faint">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-xs text-faint">
              {t("users.rolesPanel.note", { wildcard: "*" })}
            </p>
          </Panel>
        )}
      </PageContent>

      <Modal
        open={open}
        onClose={closeModal}
        title={editing ? t("users.edit") : t("users.create")}
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
            <FieldLabel htmlFor="user-email">{t("common.email")}</FieldLabel>
            <Input
              id="user-email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              autoFocus
            />
          </FieldGroup>
          <FieldGroup>
            <FieldLabel htmlFor="user-name">{t("users.form.displayName")}</FieldLabel>
            <Input
              id="user-name"
              value={form.displayName}
              onChange={(e) => setForm({ ...form, displayName: e.target.value })}
            />
          </FieldGroup>
          <FieldGroup>
            <FieldLabel htmlFor="user-role">{t("common.role")}</FieldLabel>
            <Select id="user-role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              {roleOptions.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </Select>
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
                {t("users.form.accountActive")}
              </label>
            </FieldGroup>
          )}
          <FieldGroup>
            <FieldLabel htmlFor="user-password">
              {editing ? t("users.form.newPasswordOptional") : t("common.password")}
            </FieldLabel>
            <Input
              id="user-password"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder={editing ? t("users.form.passwordKeep") : t("settings.profile.passwordMin")}
            />
          </FieldGroup>
        </div>
      </Modal>
    </PageContainer>
  );
}
