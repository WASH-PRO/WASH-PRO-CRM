import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Pencil } from 'lucide-react';
import { getProfile, setStoredUser, updateProfile } from '../api/client';
import { listDapGroups } from '../api/admin';
import { useAuth } from '../context/AuthContext';
import { PageHeader, Loading, Badge, ErrorMessage } from '../components/UI';
import { entityId, resolveGroupLabel } from '../utils/rbac';
import { formatDateTime } from '../utils/format';
import type { DapUser, User } from '../types';

type ProfileData = User & Partial<Pick<DapUser, 'status' | 'lastLoginAt' | 'createdAt'>>;

export function ProfilePage() {
  const { user, hasPermission, refreshUser } = useAuth();
  const [searchParams] = useSearchParams();
  const startEditing = searchParams.get('edit') === '1';

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(startEditing);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', email: '', password: '' });

  const canManageUsers = hasPermission('manage_users');
  const userId = user ? entityId(user) : '';

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const profileData = await getProfile();
      let groupList: Awaited<ReturnType<typeof listDapGroups>> = [];
      try {
        groupList = await listDapGroups();
      } catch {
        // Имена групп доступны только при праве просмотра справочника групп
      }
      setProfile(profileData as ProfileData);
      setGroups(groupList.map((g) => ({ id: entityId(g), name: g.name })));
      setForm({
        name: profileData.name,
        email: profileData.email,
        password: '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить профиль');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (startEditing) setEditing(true);
  }, [startEditing]);

  const groupLabels = useMemo(() => {
    const refs = profile?.groupIds ?? [];
    return refs.map((ref, index) => ({
      key: `${resolveGroupLabel(ref, groups)}-${index}`,
      label: resolveGroupLabel(ref, groups),
    }));
  }, [profile?.groupIds, groups]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      const body: { name: string; email: string; password?: string } = {
        name: form.name.trim(),
        email: form.email.trim(),
      };
      if (form.password.trim()) body.password = form.password.trim();

      const updated = await updateProfile(body);
      setProfile((prev) => ({ ...prev, ...updated }));
      setStoredUser({ ...updated, permissions: user?.permissions });
      await refreshUser();
      setEditing(false);
      setForm((prev) => ({ ...prev, password: '' }));
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  if (loading && !profile) return <Loading />;

  return (
    <div>
      <PageHeader
        title="Мой профиль"
        subtitle="Учётная запись и персональные настройки"
        actions={
          !editing && (
            <button type="button" className="btn-primary" onClick={() => setEditing(true)}>
              <Pencil size={16} /> Редактировать
            </button>
          )
        }
      />

      {error && (
        <div className="mb-4">
          <ErrorMessage message={error} />
        </div>
      )}

      {profile && !editing && (
        <div className="card max-w-2xl space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="label !mb-1">Логин</p>
              <p className="font-mono text-sm text-panel-ink dark:text-panel-ink-dark">{profile.login}</p>
            </div>
            <div>
              <p className="label !mb-1">Имя</p>
              <p className="text-sm text-panel-ink dark:text-panel-ink-dark">{profile.name}</p>
            </div>
            <div>
              <p className="label !mb-1">Email</p>
              <p className="text-sm text-panel-ink dark:text-panel-ink-dark">{profile.email}</p>
            </div>
            {'status' in profile && profile.status && (
              <div>
                <p className="label !mb-1">Статус</p>
                <Badge variant={profile.status === 'active' ? 'success' : profile.status === 'suspended' ? 'error' : 'default'}>
                  {profile.status}
                </Badge>
              </div>
            )}
          </div>

          <div>
            <p className="label !mb-2">Группы доступа</p>
            <div className="flex flex-wrap gap-2">
              {groupLabels.length ? (
                groupLabels.map(({ key, label }) => (
                  <span key={key} className="rounded-md bg-slate-100 px-2 py-1 text-xs dark:bg-slate-800">
                    {label}
                  </span>
                ))
              ) : (
                <span className="text-sm text-panel-muted">—</span>
              )}
            </div>
          </div>

          {profile.lastLoginAt && (
            <p className="text-xs text-panel-muted dark:text-panel-muted-dark">
              Последний вход: {formatDateTime(profile.lastLoginAt)}
            </p>
          )}

          {canManageUsers && userId && (
            <div className="border-t border-panel-border pt-4 dark:border-panel-border-dark">
              <Link
                to={`/users?edit=${encodeURIComponent(userId)}`}
                className="text-sm text-brand-600 hover:underline dark:text-brand-400"
              >
                Расширенное редактирование (группы, статус) →
              </Link>
            </div>
          )}
        </div>
      )}

      {profile && editing && (
        <form onSubmit={handleSubmit} className="card max-w-2xl space-y-4">
          {formError && <ErrorMessage message={formError} />}
          <div>
            <label className="label">Логин</label>
            <input className="input font-mono" value={profile.login} disabled readOnly />
          </div>
          <div>
            <label className="label">Имя</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
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
            <label className="label">Новый пароль (необязательно)</label>
            <input
              className="input"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              autoComplete="new-password"
            />
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setEditing(false);
                setForm({ name: profile.name, email: profile.email, password: '' });
                setFormError(null);
              }}
            >
              Отмена
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Сохранение…' : 'Сохранить'}
            </button>
          </div>
          {canManageUsers && userId && (
            <p className="text-xs text-panel-muted dark:text-panel-muted-dark">
              Для смены групп и статуса используйте{' '}
              <Link to={`/users?edit=${encodeURIComponent(userId)}`} className="text-brand-600 hover:underline dark:text-brand-400">
                редактирование пользователя
              </Link>
              .
            </p>
          )}
        </form>
      )}
    </div>
  );
}
