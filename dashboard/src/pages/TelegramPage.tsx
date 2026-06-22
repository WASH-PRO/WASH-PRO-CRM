import { FormEvent, useEffect, useState } from 'react';
import { api, apiList } from '../api/client';
import { PageHeader, Loading } from '../components/UI';
import type { CrmSetting } from '../types';

const ALL_COMMANDS = ['/status', '/washes', '/posts', '/revenue', '/statistics', '/cards'];

export function TelegramPage() {
  const [token, setToken] = useState('');
  const [adminIds, setAdminIds] = useState('');
  const [commands, setCommands] = useState<string[]>(ALL_COMMANDS);
  const [enabled, setEnabled] = useState(false);
  const [settingId, setSettingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiList<CrmSetting>('/crm/settings').then((settings) => {
      const tg = settings.find((s) => s.key === 'telegram');
      if (tg) {
        setSettingId(tg.id);
        const v = tg.value as {
          token?: string;
          adminIds?: number[];
          allowedCommands?: string[];
          enabled?: boolean;
        };
        setToken(v.token || '');
        setAdminIds((v.adminIds || []).join(', '));
        setCommands(v.allowedCommands || ALL_COMMANDS);
        setEnabled(v.enabled ?? false);
      }
      setLoading(false);
    });
  }, []);

  const toggleCommand = (cmd: string) => {
    setCommands((prev) => (prev.includes(cmd) ? prev.filter((c) => c !== cmd) : [...prev, cmd]));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!settingId) return;
    await api(`/crm/settings/${settingId}`, {
      method: 'PUT',
      body: JSON.stringify({
        key: 'telegram',
        value: {
          token,
          adminIds: adminIds.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n)),
          allowedCommands: commands,
          enabled,
        },
      }),
    });
    alert('Настройки Telegram сохранены');
  };

  if (loading) return <Loading />;

  return (
    <div>
      <PageHeader title="Telegram Bot" subtitle="Настройка бота уведомлений и команд" />
      <form onSubmit={handleSubmit} className="card max-w-lg space-y-4">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Бот включён
        </label>
        <div>
          <label className="label">Token</label>
          <input className="input font-mono text-xs" value={token} onChange={(e) => setToken(e.target.value)} placeholder="123456:ABC..." />
        </div>
        <div>
          <label className="label">ID администраторов (через запятую)</label>
          <input className="input" value={adminIds} onChange={(e) => setAdminIds(e.target.value)} placeholder="123456789, 987654321" />
        </div>
        <div>
          <label className="label mb-2">Разрешённые команды</label>
          <div className="flex flex-wrap gap-2">
            {ALL_COMMANDS.map((cmd) => (
              <label key={cmd} className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm dark:border-slate-700">
                <input type="checkbox" checked={commands.includes(cmd)} onChange={() => toggleCommand(cmd)} />
                {cmd}
              </label>
            ))}
          </div>
        </div>
        <button type="submit" className="btn-primary">Сохранить</button>
      </form>
    </div>
  );
}
