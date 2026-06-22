import { useEffect, useState } from 'react';
import { HardDrive } from 'lucide-react';
import { api, apiList } from '../api/client';
import { PageHeader, Table, Loading, Badge } from '../components/UI';
import type { BackupRecord, CrmSetting } from '../types';

export function BackupsPage() {
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [settings, setSettings] = useState({ enabled: true, cron: '0 2 * * *', retentionCount: 7 });
  const [settingId, setSettingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const [b, s] = await Promise.all([
      apiList<BackupRecord>('/crm/backups'),
      apiList<CrmSetting>('/crm/settings'),
    ]);
    setBackups(b);
    const backup = s.find((x) => x.key === 'backup');
    if (backup) {
      setSettingId(backup.id);
      setSettings(backup.value as typeof settings);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const createManual = async () => {
    await api('/crm/backups', {
      method: 'POST',
      body: JSON.stringify({
        filename: `manual-${Date.now()}.pending`,
        type: 'manual',
        status: 'in_progress',
        createdAt: new Date().toISOString(),
      }),
    });
    alert('Запрос на резервное копирование создан. Сервис backup выполнит операцию по расписанию или при следующем цикле.');
    load();
  };

  const saveSettings = async () => {
    if (!settingId) return;
    await api(`/crm/settings/${settingId}`, {
      method: 'PUT',
      body: JSON.stringify({ key: 'backup', value: settings }),
    });
    alert('Настройки сохранены');
  };

  if (loading) return <Loading />;

  return (
    <div>
      <PageHeader
        title="Резервные копии"
        subtitle="Автоматическое и ручное резервное копирование MongoDB"
        actions={<button className="btn-primary" onClick={createManual}><HardDrive size={16} /> Создать копию</button>}
      />

      <div className="card mb-6 max-w-lg space-y-3">
        <h2 className="font-semibold">Настройки</h2>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={settings.enabled} onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })} />
          Автоматическое резервное копирование
        </label>
        <div>
          <label className="label">Расписание (cron)</label>
          <input className="input" value={settings.cron} onChange={(e) => setSettings({ ...settings, cron: e.target.value })} />
        </div>
        <div>
          <label className="label">Количество копий</label>
          <input className="input" type="number" min={1} max={30} value={settings.retentionCount} onChange={(e) => setSettings({ ...settings, retentionCount: Number(e.target.value) })} />
        </div>
        <button className="btn-primary" onClick={saveSettings}>Сохранить настройки</button>
      </div>

      <Table>
        <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50">
          <tr>
            <th className="px-4 py-3">Файл</th>
            <th className="px-4 py-3">Тип</th>
            <th className="px-4 py-3">Размер</th>
            <th className="px-4 py-3">Статус</th>
            <th className="px-4 py-3">Дата</th>
          </tr>
        </thead>
        <tbody>
          {backups.map((b) => (
            <tr key={b.id} className="border-b border-slate-100 dark:border-slate-800">
              <td className="px-4 py-3 font-mono text-xs">{b.filename}</td>
              <td className="px-4 py-3">{b.type === 'auto' ? 'Авто' : 'Ручная'}</td>
              <td className="px-4 py-3">{b.size ? `${(b.size / 1024 / 1024).toFixed(2)} МБ` : '—'}</td>
              <td className="px-4 py-3">
                <Badge variant={b.status === 'completed' ? 'success' : b.status === 'failed' ? 'error' : 'warning'}>
                  {b.status}
                </Badge>
              </td>
              <td className="px-4 py-3">{b.createdAt ? new Date(b.createdAt).toLocaleString('ru') : '—'}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
