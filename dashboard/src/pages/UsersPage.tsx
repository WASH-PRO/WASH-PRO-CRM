import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { api } from '../api/client';
import { listDapGroups, listDapUsers } from '../api/admin';
import { useAuth } from '../context/AuthContext';
import { LIVE_INTERVAL_SLOW_MS } from '../constants/live';
import { usePolling } from '../hooks/usePolling';
import { PageHeader, Loading, Modal, Badge, ErrorMessage } from '../components/UI';
import { PasswordInput } from '../components/PasswordInput';
import { DataTable, type DataTableColumn, type DataTableFilter } from '../components/DataTable';
import type { DapUser } from '../types';
import { entityId, getUserStatusLabels } from '../utils/rbac';
import { formatDateTime } from '../utils/format';
import { useLocale } from '../i18n/LocaleContext';

const emptyForm = {
  login: '',
  email: '',
  name: '',
  password: '',
  status: 'active' as DapUser['status'],
  groupIds: [] as string[],
  telegramUserId: '',
};

export function UsersPage() {
  const { t } = useLocale();
  const { hasPermission, user: currentUser } = useAuth();
  const canEdit = hasPermission('manage_users');
  const userStatusLabels = useMemo(() => getUserStatusLabels(t), [t]);

  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const [users, groups] = await Promise.all([listDapUsers(), listDapGroups()]);
    return { users, groups };
  }, []);

  const { data, loading, error, refresh } = usePolling(fetchData, [], { intervalMs: LIVE_INTERVAL_SLOW_MS });
  const users = data?.users ?? [];
  const groups = data?.groups ?? [];
  const [searchParams, setSearchParams] = useSearchParams();

  const groupNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const g of groups) map.set(entityId(g), g.name);
    return map;
  }, [groups]);

  const openCreate = () => {
    setForm(emptyForm);
    setEditId(null);
    setFormError(null);
    setModal(true);
  };

  const openEdit = (u: DapUser) => {
    setForm({
      login: u.login,
      email: u.email,
      name: u.name,
      password: '',
      status: u.status,
      groupIds: u.groupIds ?? [],
      telegramUserId: u.telegramUserId ? String(u.telegramUserId) : '',
    });
    setEditId(entityId(u));
    setFormError(null);
    setModal(true);
  };

  useEffect(() => {
    const editIdFromUrl = searchParams.get('edit');
    if (!editIdFromUrl || !users.length || !canEdit) return;
    const target = users.find((u) => entityId(u) === editIdFromUrl);
    if (!target) return;
    openEdit(target);
    const next = new URLSearchParams(searchParams);
    next.delete('edit');
    setSearchParams(next, { replace: true });
  }, [users, searchParams, canEdit, setSearchParams]);

  const toggleGroup = (groupId: string) => {
    setForm((prev) => ({
      ...prev,
      groupIds: prev.groupIds.includes(groupId)
        ? prev.groupIds.filter((id) => id !== groupId)
        : [...prev.groupIds, groupId],
    }));
  };

  const handleDelete = async (u: DapUser) => {
    const id = entityId(u);
    if (id === entityId(currentUser ?? {})) {
      alert(t('pages.users.errors.cannotDeleteCurrent'));
      return;
    }
    if (!confirm(t('pages.users.confirmDelete', { login: u.login }))) return;
    await api(`/users/${id}`, { method: 'DELETE' });
    refresh();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      const body: Record<string, unknown> = {
        login: form.login.trim(),
        email: form.email.trim(),
        name: form.name.trim(),
        status: form.status,
        groupIds: form.groupIds,
      };
      const telegramRaw = form.telegramUserId.trim();
      if (telegramRaw) {
        const telegramUserId = Number(telegramRaw);
        if (!Number.isInteger(telegramUserId) || telegramUserId <= 0) {
          setFormError(t('pages.users.errors.invalidTelegramUserId'));
          return;
        }
        body.telegramUserId = telegramUserId;
      } else if (editId) {
        body.telegramUserId = null;
      }
      if (form.password.trim()) body.password = form.password;

      if (editId) {
        if (!form.password.trim()) delete body.password;
        await api(`/users/${editId}`, { method: 'PUT', body: JSON.stringify(body) });
      } else {
        if (!form.password.trim()) {
          setFormError(t('pages.users.errors.passwordRequired'));
          return;
        }
        await api('/users', { method: 'POST', body: JSON.stringify(body) });
      }
      setModal(false);
      refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t('errors.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const filters: DataTableFilter<DapUser>[] = useMemo(
    () => [
      {
        id: 'status',
        label: t('common.status'),
        options: (['active', 'inactive', 'suspended'] as const).map((s) => ({
          value: s,
          label: userStatusLabels[s] ?? s,
        })),
        match: (u, value) => u.status === value,
      },
      {
        id: 'group',
        label: t('pages.users.group'),
        options: groups.map((g) => ({ value: entityId(g), label: g.name })),
        match: (u, value) => (u.groupIds ?? []).includes(value),
      },
    ],
    [groups, t, userStatusLabels]
  );

  const columns: DataTableColumn<DapUser>[] = useMemo(
    () => [
      {
        key: 'login',
        header: t('pages.users.login'),
        sortable: true,
        searchValue: (u) => `${u.login} ${u.name} ${u.email}`,
        sortValue: (u) => u.login,
        render: (u) => (
          <div>
            <div className="font-medium">{u.login}</div>
            <div className="text-xs text-panel-muted dark:text-panel-muted-dark">{u.name}</div>
          </div>
        ),
      },
      {
        key: 'email',
        header: 'Email',
        sortable: true,
        sortValue: (u) => u.email,
        searchValue: (u) => u.email,
        render: (u) => u.email,
      },
      {
        key: 'telegramUserId',
        header: 'Telegram ID',
        sortable: true,
        sortValue: (u) => u.telegramUserId ?? 0,
        searchValue: (u) => (u.telegramUserId ? String(u.telegramUserId) : ''),
        render: (u) =>
          u.telegramUserId ? (
            <code className="text-xs">{u.telegramUserId}</code>
          ) : (
            <span className="text-panel-muted">—</span>
          ),
      },
      {
        key: 'status',
        header: t('common.status'),
        sortable: true,
        sortValue: (u) => u.status,
        render: (u) => (
          <Badge variant={u.status === 'active' ? 'success' : u.status === 'suspended' ? 'error' : 'default'}>
            {userStatusLabels[u.status] ?? u.status}
          </Badge>
        ),
      },
      {
        key: 'groups',
        header: t('pages.users.groups'),
        sortable: true,
        sortValue: (u) => (u.groupIds ?? []).map((gid) => groupNameById.get(gid) ?? gid).join(','),
        searchValue: (u) => (u.groupIds ?? []).map((gid) => groupNameById.get(gid) ?? gid).join(' '),
        render: (u) => (
          <div className="flex flex-wrap gap-1">
            {(u.groupIds ?? []).length ? (
              u.groupIds.map((gid) => (
                <span
                  key={gid}
                  className="rounded bg-slate-100 px-1.5 py-0.5 text-xs dark:bg-slate-800"
                >
                  {groupNameById.get(gid) ?? gid.slice(-6)}
                </span>
              ))
            ) : (
              <span className="text-panel-muted">—</span>
            )}
          </div>
        ),
      },
      {
        key: 'lastLoginAt',
        header: t('pages.users.lastLogin'),
        sortable: true,
        sortValue: (u) => u.lastLoginAt ?? '',
        render: (u) => (u.lastLoginAt ? formatDateTime(u.lastLoginAt) : '—'),
      },
      ...(canEdit
        ? [
            {
              key: 'actions',
              header: '',
              render: (u: DapUser) => (
                <div className="flex justify-end gap-1">
                  <button
                    type="button"
                    className="btn-secondary !px-2 !py-1"
                    onClick={() => openEdit(u)}
                    title={t('common.edit')}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    className="btn-secondary !px-2 !py-1 text-red-600"
                    disabled={entityId(u) === entityId(currentUser ?? {})}
                    onClick={() => void handleDelete(u)}
                    title={t('common.delete')}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ),
            } as DataTableColumn<DapUser>,
          ]
        : []),
    ],
    [canEdit, groupNameById, currentUser, t, userStatusLabels]
  );

  if (loading && !data) return <Loading />;

  return (
    <div>
      <PageHeader
        title={t('nav.items.users')}
        subtitle={t('pages.users.subtitle')}
        actions={
          canEdit && (
            <button type="button" className="btn-primary" onClick={openCreate}>
              <Plus size={16} /> {t('pages.users.add')}
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
        tableId="users"
        columns={columns}
        data={users}
        rowKey={(u) => entityId(u)}
        filters={filters}
        searchPlaceholder={t('pages.users.searchPlaceholder')}
      />

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editId ? t('pages.users.editUser') : t('pages.users.newUser')}
      >
        <form onSubmit={handleSubmit} className="space-y-3">
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <div>
            <label className="label">{t('pages.users.login')}</label>
            <input
              className="input"
              value={form.login}
              onChange={(e) => setForm({ ...form, login: e.target.value })}
              required
              disabled={Boolean(editId)}
            />
          </div>
          <div>
            <label className="label">Email</label>
            <input
              className="input"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="label">{t('pages.users.name')}</label>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div>
            <label className="label">Telegram user_id</label>
            <input
              className="input font-mono text-sm"
              value={form.telegramUserId}
              onChange={(e) => setForm({ ...form, telegramUserId: e.target.value.replace(/[^\d]/g, '') })}
              placeholder={t('pages.users.telegramPlaceholder')}
            />
            <p className="mt-1 text-xs text-panel-muted dark:text-panel-muted-dark">
              {t('pages.users.telegramHint')}
            </p>
          </div>
          <div>
            <label className="label">
              {t('pages.login.password')} {editId ? t('pages.users.passwordEditHint') : ''}
            </label>
            <PasswordInput
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required={!editId}
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="label">{t('common.status')}</label>
            <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as DapUser['status'] })}>
              <option value="active">{userStatusLabels.active}</option>
              <option value="inactive">{userStatusLabels.inactive}</option>
              <option value="suspended">{userStatusLabels.suspended}</option>
            </select>
          </div>
          <div>
            <label className="label mb-2">{t('pages.users.accessGroups')}</label>
            <div className="max-h-40 space-y-2 overflow-y-auto rounded-lg border border-panel-border p-3 dark:border-panel-border-dark">
              {groups.map((g) => {
                const gid = entityId(g);
                return (
                  <label key={gid} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={form.groupIds.includes(gid)} onChange={() => toggleGroup(gid)} />
                    <span>{g.name}</span>
                    {g.description && <span className="text-xs text-panel-muted">— {g.description}</span>}
                  </label>
                );
              })}
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
