import { FormEvent, useEffect, useState } from 'react';
import { api, apiList } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { PageHeader, Table, Loading } from '../components/UI';
import type { ArchiveLog, CrmSetting } from '../types';

const RETENTION_OPTIONS = [30, 90, 180, 365];

export function ArchivePage() {
  const { hasPermission } = useAuth();
  const canEdit = hasPermission('update', 'delete');
  const [logs, setLogs] = useState<ArchiveLog[]>([]);
  const [setting, setSetting] = useState<{ retentionDays: number; autoArchive: boolean; autoDelete: boolean }>({
    retentionDays: 90,
    autoArchive: true,
    autoDelete: false,
  });
  const [settingId, setSettingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const load = async () => {
    setLoading(true);
    const [l, settings] = await Promise.all([
      apiList<ArchiveLog>('/crm/archive-logs'),
      apiList<CrmSetting>('/crm/settings'),
    ]);
    setLogs(l);
    const archive = settings.find((s) => s.key === 'archive');
    if (archive) {
      setSettingId(archive.id);
      setSetting(archive.value as typeof setting);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const savePolicy = async (e: FormEvent) => {
    e.preventDefault();
    if (!settingId) return;
    await api(`/crm/settings/${settingId}`, {
      method: 'PUT',
      body: JSON.stringify({ key: 'archive', value: setting }),
    });
    setMessage('Политика архивирования сохранена');
  };

  const runArchive = async () => {
    await api('/crm/archive-logs', {
      method: 'POST',
      body: JSON.stringify({
        action: 'archive',
        recordsAffected: 0,
        policyDays: setting.retentionDays,
        createdAt: new Date().toISOString(),
        details: { manual: true },
      }),
    });
    setMessage('Запрос на архивирование отправлен. Операция выполняется сервисом backup.');
    load();
  };

  if (loading) return <Loading />;

  return (
    <div>
      <PageHeader title="Архивирование" subtitle="Политика хранения и журнал операций" />
      {message && <p className="mb-4 text-sm text-emerald-600">{message}</p>}

      <form onSubmit={savePolicy} className="card mb-6 max-w-lg space-y-4">
        <h2 className="font-semibold">Политика хранения</h2>
        <div>
          <label className="label">Хранить данные (дней)</label>
          <select
            className="input"
            value={setting.retentionDays}
            onChange={(e) => setSetting({ ...setting, retentionDays: Number(e.target.value) })}
            disabled={!canEdit}
          >
            {RETENTION_OPTIONS.map((d) => (
              <option key={d} value={d}>{d} дней</option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={setting.autoArchive} onChange={(e) => setSetting({ ...setting, autoArchive: e.target.checked })} disabled={!canEdit} />
          Автоматическое архивирование
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={setting.autoDelete} onChange={(e) => setSetting({ ...setting, autoDelete: e.target.checked })} disabled={!canEdit} />
          Удалять после архивирования
        </label>
        {canEdit && (
          <div className="flex gap-2">
            <button type="submit" className="btn-primary">Сохранить</button>
            <button type="button" className="btn-secondary" onClick={runArchive}>Запустить архивирование</button>
          </div>
        )}
      </form>

      <Table>
        <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50">
          <tr>
            <th className="px-4 py-3">Действие</th>
            <th className="px-4 py-3">Записей</th>
            <th className="px-4 py-3">Политика</th>
            <th className="px-4 py-3">Дата</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((l) => (
            <tr key={l.id} className="border-b border-slate-100 dark:border-slate-800">
              <td className="px-4 py-3">{l.action}</td>
              <td className="px-4 py-3">{l.recordsAffected}</td>
              <td className="px-4 py-3">{l.policyDays} дней</td>
              <td className="px-4 py-3">{l.createdAt ? new Date(l.createdAt).toLocaleString('ru') : '—'}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
