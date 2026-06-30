import { FormEvent, useCallback, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { api } from '../api/client';
import { listDapGroups } from '../api/admin';
import { useAuth } from '../context/AuthContext';
import { LIVE_INTERVAL_SLOW_MS } from '../constants/live';
import { usePolling } from '../hooks/usePolling';
import { PageHeader, Loading, Modal, Badge, ErrorMessage } from '../components/UI';
import { DataTable, type DataTableColumn } from '../components/DataTable';
import type { DapGroup, Permission } from '../types';
import { ALL_PERMISSIONS, entityId, PERMISSION_LABELS } from '../utils/rbac';

const emptyForm = {
  name: '',
  description: '',
  permissions: ['view'] as Permission[],
};

export function GroupsPage() {
  const { hasPermission } = useAuth();
  const canEdit = hasPermission('manage_users');
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
      alert('Системную группу нельзя удалить');
      return;
    }
    if (!confirm(`Удалить группу «${g.name}»?`)) return;
    await api(`/groups/${entityId(g)}`, { method: 'DELETE' });
    refresh();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.permissions.length) {
      setFormError('Выберите хотя бы одно право');
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
      setFormError(err instanceof Error ? err.message : 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const columns: DataTableColumn<DapGroup>[] = useMemo(
    () => [
      {
        key: 'name',
        header: 'Группа',
        sortable: true,
        searchValue: (g) => `${g.name} ${g.description ?? ''}`,
        sortValue: (g) => g.name,
        render: (g) => (
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium">{g.name}</span>
              {g.isSystem && <Badge variant="default">Системная</Badge>}
            </div>
            {g.description && (
              <div className="text-xs text-panel-muted dark:text-panel-muted-dark">{g.description}</div>
            )}
          </div>
        ),
      },
      {
        key: 'permissions',
        header: 'Права доступа',
        render: (g) => (
          <div className="flex flex-wrap gap-1">
            {(g.permissions ?? []).map((p) => (
              <span key={p} className="rounded bg-brand-600/10 px-1.5 py-0.5 text-[11px] text-brand-700 dark:text-brand-300">
                {PERMISSION_LABELS[p] ?? p}
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
                <div className="text-right">
                  <button type="button" className="btn-secondary mr-2" onClick={() => openEdit(g)}>
                    Изменить
                  </button>
                  {!g.isSystem && (
                    <button type="button" className="btn-secondary text-red-600" onClick={() => void handleDelete(g)}>
                      Удалить
                    </button>
                  )}
                </div>
              ),
            } as DataTableColumn<DapGroup>,
          ]
        : []),
    ],
    [canEdit]
  );

  if (loading && !groups) return <Loading />;

  return (
    <div>
      <PageHeader
        title="Группы и права"
        subtitle="Роли пользователей и матрица прав доступа (RBAC)"
        actions={
          canEdit && (
            <button type="button" className="btn-primary" onClick={openCreate}>
              <Plus size={16} /> Добавить группу
            </button>
          )
        }
      />
      {error && (
        <div className="mb-4">
          <ErrorMessage message={error} />
        </div>
      )}
      <DataTable columns={columns} data={groups ?? []} rowKey={(g) => entityId(g)} searchPlaceholder="Поиск групп…" />

      <Modal open={modal} onClose={() => setModal(false)} title={editId ? 'Редактировать группу' : 'Новая группа'}>
        <form onSubmit={handleSubmit} className="space-y-3">
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <div>
            <label className="label">Название</label>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div>
            <label className="label">Описание</label>
            <input
              className="input"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Необязательно"
            />
          </div>
          <div>
            <label className="label mb-2">Права доступа</label>
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
                    <span className="font-medium">{PERMISSION_LABELS[perm]}</span>
                    <span className="mt-0.5 block font-mono text-[10px] text-panel-muted">{perm}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
          <button type="submit" className="btn-primary w-full" disabled={saving}>
            {saving ? 'Сохранение…' : 'Сохранить'}
          </button>
        </form>
      </Modal>
    </div>
  );
}
