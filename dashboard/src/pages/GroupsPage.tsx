import { FormEvent, useCallback, useMemo, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { api } from '../api/client';
import { listDapGroups } from '../api/admin';
import { useAuth } from '../context/AuthContext';
import { LIVE_INTERVAL_SLOW_MS } from '../constants/live';
import { usePolling } from '../hooks/usePolling';
import { PageHeader, Loading, Modal, Badge, ErrorMessage } from '../components/UI';
import { DataTable, type DataTableColumn, type DataTableFilter } from '../components/DataTable';
import type { DapGroup, Permission } from '../types';
import { ALL_PERMISSIONS, entityId, getPermissionLabels } from '../utils/rbac';
import { useLocale } from '../i18n/LocaleContext';

const emptyForm = {
  name: '',
  description: '',
  permissions: ['view'] as Permission[],
};

export function GroupsPage() {
  const { t } = useLocale();
  const { hasPermission } = useAuth();
  const canEdit = hasPermission('manage_users');
  const permissionLabels = useMemo(() => getPermissionLabels(t), [t]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchGroups = useCallback(() => listDapGroups(), []);
  const { data: groups, loading, error, refresh } = usePolling(fetchGroups, [], { intervalMs: LIVE_INTERVAL_SLOW_MS });

  const openCreate = () => {
    setForm(emptyForm);
    setEditId(null);
    setFormError(null);
    setModal(true);
  };

  const openEdit = (g: DapGroup) => {
    setForm({
      name: g.name,
      description: g.description ?? '',
      permissions: g.permissions?.length ? [...g.permissions] : ['view'],
    });
    setEditId(entityId(g));
    setFormError(null);
    setModal(true);
  };

  const togglePermission = (perm: Permission) => {
    setForm((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(perm)
        ? prev.permissions.filter((p) => p !== perm)
        : [...prev.permissions, perm],
    }));
  };

  const handleDelete = async (g: DapGroup) => {
    if (g.isSystem) {
      alert(t('pages.groups.errors.cannotDeleteSystem'));
      return;
    }
    if (!confirm(t('pages.groups.confirmDelete', { name: g.name }))) return;
    await api(`/groups/${entityId(g)}`, { method: 'DELETE' });
    refresh();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.permissions.length) {
      setFormError(t('pages.groups.errors.permissionRequired'));
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const body = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        permissions: form.permissions,
      };
      if (editId) {
        await api(`/groups/${editId}`, { method: 'PUT', body: JSON.stringify(body) });
      } else {
        await api('/groups', { method: 'POST', body: JSON.stringify(body) });
      }
      setModal(false);
      refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t('errors.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const filters: DataTableFilter<DapGroup>[] = useMemo(
    () => [
      {
        id: 'type',
        label: t('pages.groups.type'),
        options: [
          { value: 'system', label: t('pages.groups.system') },
          { value: 'custom', label: t('pages.groups.custom') },
        ],
        match: (g, value) => (value === 'system' ? !!g.isSystem : !g.isSystem),
      },
      {
        id: 'permission',
        label: t('pages.groups.permission'),
        options: ALL_PERMISSIONS.map((p) => ({ value: p, label: permissionLabels[p] ?? p })),
        match: (g, value) => (g.permissions ?? []).includes(value as Permission),
      },
    ],
    [permissionLabels, t]
  );

  const columns: DataTableColumn<DapGroup>[] = useMemo(
    () => [
      {
        key: 'name',
        header: t('pages.groups.group'),
        sortable: true,
        searchValue: (g) => `${g.name} ${g.description ?? ''}`,
        sortValue: (g) => g.name,
        render: (g) => (
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium">{g.name}</span>
              {g.isSystem && <Badge variant="default">{t('pages.groups.system')}</Badge>}
            </div>
            {g.description && (
              <div className="text-xs text-panel-muted dark:text-panel-muted-dark">{g.description}</div>
            )}
          </div>
        ),
      },
      {
        key: 'permissions',
        header: t('pages.groups.accessPermissions'),
        sortable: true,
        sortValue: (g) => (g.permissions ?? []).join(','),
        searchValue: (g) => (g.permissions ?? []).map((p) => permissionLabels[p] ?? p).join(' '),
        render: (g) => (
          <div className="flex flex-wrap gap-1">
            {(g.permissions ?? []).map((p) => (
              <span key={p} className="rounded bg-brand-600/10 px-1.5 py-0.5 text-[11px] text-brand-700 dark:text-brand-300">
                {permissionLabels[p] ?? p}
              </span>
            ))}
          </div>
        ),
      },
      ...(canEdit
        ? [
            {
              key: 'actions',
              header: '',
              render: (g: DapGroup) => (
                <div className="flex justify-end gap-1">
                  <button
                    type="button"
                    className="btn-secondary !px-2 !py-1"
                    onClick={() => openEdit(g)}
                    title={t('common.edit')}
                  >
                    <Pencil size={14} />
                  </button>
                  {!g.isSystem && (
                    <button
                      type="button"
                      className="btn-secondary !px-2 !py-1 text-red-600"
                      onClick={() => void handleDelete(g)}
                      title={t('common.delete')}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ),
            } as DataTableColumn<DapGroup>,
          ]
        : []),
    ],
    [canEdit, permissionLabels, t]
  );

  if (loading && !groups) return <Loading />;

  return (
    <div>
      <PageHeader
        title={t('nav.items.groups')}
        subtitle={t('pages.groups.subtitle')}
        actions={
          canEdit && (
            <button type="button" className="btn-primary" onClick={openCreate}>
              <Plus size={16} /> {t('pages.groups.add')}
            </button>
          )
        }
      />
      {error && (
        <div className="mb-4">
          <ErrorMessage message={error} />
        </div>
      )}
      <DataTable
        tableId="groups"
        columns={columns}
        data={groups ?? []}
        rowKey={(g) => entityId(g)}
        filters={filters}
        searchPlaceholder={t('pages.groups.searchPlaceholder')}
      />

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editId ? t('pages.groups.editGroup') : t('pages.groups.newGroup')}
      >
        <form onSubmit={handleSubmit} className="space-y-3">
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <div>
            <label className="label">{t('pages.groups.name')}</label>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div>
            <label className="label">{t('pages.groups.description')}</label>
            <input
              className="input"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder={t('pages.groups.optional')}
            />
          </div>
          <div>
            <label className="label mb-2">{t('pages.groups.accessPermissions')}</label>
            <div className="grid gap-2 sm:grid-cols-2">
              {ALL_PERMISSIONS.map((perm) => (
                <label
                  key={perm}
                  className="flex items-start gap-2 rounded-lg border border-panel-border px-3 py-2 text-sm dark:border-panel-border-dark"
                >
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={form.permissions.includes(perm)}
                    onChange={() => togglePermission(perm)}
                  />
                  <span>
                    <span className="font-medium">{permissionLabels[perm]}</span>
                    <span className="mt-0.5 block font-mono text-[10px] text-panel-muted">{perm}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
          <button type="submit" className="btn-primary w-full" disabled={saving}>
            {saving ? t('common.saving') : t('common.save')}
          </button>
        </form>
      </Modal>
    </div>
  );
}
