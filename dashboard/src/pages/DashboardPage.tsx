import { useEffect, useState } from 'react';
import { apiList } from '../api/client';
import { PageHeader, StatCard, Loading, Badge } from '../components/UI';
import { DashboardCharts } from '../components/DashboardCharts';
import type { Wash, Post, PostState, Notification, UsageStat, FinanceStat } from '../types';

export function DashboardPage() {
  const [washes, setWashes] = useState<Wash[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [states, setStates] = useState<PostState[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [usageStats, setUsageStats] = useState<UsageStat[]>([]);
  const [financeStats, setFinanceStats] = useState<FinanceStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiList<Wash>('/crm/washes'),
      apiList<Post>('/crm/posts'),
      apiList<PostState>('/crm/post-states'),
      apiList<Notification>('/crm/notifications'),
      apiList<UsageStat>('/crm/usage-stats'),
      apiList<FinanceStat>('/crm/finance-stats'),
    ])
      .then(([w, p, s, n, usage, finance]) => {
        setWashes(w);
        setPosts(p);
        setStates(s);
        setNotifications(n.filter((x) => !x.read).slice(0, 5));
        setUsageStats(usage);
        setFinanceStats(finance);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading />;

  const online = posts.filter((p) => p.status === 'online').length;
  const offline = posts.filter((p) => p.status === 'offline').length;
  const errors = posts.filter((p) => p.status === 'error').length;

  return (
    <div>
      <PageHeader title="Обзор" subtitle={`Версия ${import.meta.env.VITE_APP_VERSION || '1.0.0'}`} />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Автомоек" value={washes.length} />
        <StatCard label="Постов онлайн" value={`${online}/${posts.length}`} />
        <StatCard label="Офлайн" value={offline} />
        <StatCard label="Ошибки" value={errors} />
      </div>

      <DashboardCharts posts={posts} usageStats={usageStats} financeStats={financeStats} />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-4 font-semibold">Текущее состояние постов</h2>
          {states.length === 0 ? (
            <p className="text-sm text-slate-500">Нет данных о состоянии</p>
          ) : (
            <div className="space-y-3">
              {states.slice(0, 8).map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-lg border border-slate-100 p-3 dark:border-slate-800">
                  <div>
                    <div className="font-medium">{s.modeName || s.mode || '—'}</div>
                    <div className="text-xs text-slate-500">Пост {s.postId.slice(-6)}</div>
                  </div>
                  <Badge variant={s.connected ? 'success' : 'warning'}>
                    {s.connected ? 'Связь' : 'Нет связи'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="mb-4 font-semibold">Последние уведомления</h2>
          {notifications.length === 0 ? (
            <p className="text-sm text-slate-500">Нет новых уведомлений</p>
          ) : (
            <div className="space-y-3">
              {notifications.map((n) => (
                <div key={n.id} className="rounded-lg border border-slate-100 p-3 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <Badge variant={n.severity === 'error' ? 'error' : n.severity === 'warning' ? 'warning' : 'default'}>
                      {n.type}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm">{n.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
