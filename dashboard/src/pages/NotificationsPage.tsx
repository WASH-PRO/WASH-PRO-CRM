import { useEffect, useState } from 'react';
import { api, apiList } from '../api/client';
import { PageHeader, Table, Loading, Badge } from '../components/UI';
import type { Notification } from '../types';

export function NotificationsPage() {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiList<Notification>('/crm/notifications').then(setItems).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const markRead = async (id: string) => {
    await api(`/crm/notifications/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ read: true }),
    });
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  if (loading) return <Loading />;

  return (
    <div>
      <PageHeader title="Уведомления" subtitle="Telegram и Web Notifications" />
      <Table>
        <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50">
          <tr>
            <th className="px-4 py-3">Тип</th>
            <th className="px-4 py-3">Важность</th>
            <th className="px-4 py-3">Сообщение</th>
            <th className="px-4 py-3">Каналы</th>
            <th className="px-4 py-3">Дата</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {items.map((n) => (
            <tr key={n.id} className={`border-b border-slate-100 dark:border-slate-800 ${n.read ? 'opacity-60' : ''}`}>
              <td className="px-4 py-3">{n.type}</td>
              <td className="px-4 py-3">
                <Badge variant={n.severity === 'error' ? 'error' : n.severity === 'warning' ? 'warning' : 'default'}>
                  {n.severity}
                </Badge>
              </td>
              <td className="px-4 py-3">{n.message}</td>
              <td className="px-4 py-3 text-xs">{(n.channels || []).join(', ')}</td>
              <td className="px-4 py-3 text-sm">{n.createdAt ? new Date(n.createdAt).toLocaleString('ru') : '—'}</td>
              <td className="px-4 py-3">
                {!n.read && <button className="btn-secondary text-xs" onClick={() => markRead(n.id)}>Прочитано</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
