import { useEffect, useMemo, useState } from 'react';
import { apiList } from '../api/client';
import { PageHeader, Table, Loading, StatCard, periodLabel, categoryLabel } from '../components/UI';
import type { UsageStat } from '../types';

export function UsagePage() {
  const [stats, setStats] = useState<UsageStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<string>('all');

  useEffect(() => {
    apiList<UsageStat>('/crm/usage-stats').then(setStats).finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(
    () => (period === 'all' ? stats : stats.filter((s) => s.period === period)),
    [stats, period]
  );

  const totals = useMemo(() => ({
    launches: filtered.reduce((s, x) => s + (x.launchCount || 0), 0),
    time: filtered.reduce((s, x) => s + (x.usageTime || 0), 0),
    clients: filtered.reduce((s, x) => s + (x.clientCount || 0), 0),
  }), [filtered]);

  if (loading) return <Loading />;

  return (
    <div>
      <PageHeader
        title="Статистика использования"
        subtitle="До и после инкассации, по постам и автомойкам"
        actions={
          <select className="input w-auto" value={period} onChange={(e) => setPeriod(e.target.value)}>
            <option value="all">Все периоды</option>
            <option value="before_collection">До инкассации</option>
            <option value="after_collection">После инкассации</option>
          </select>
        }
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Запусков" value={totals.launches} />
        <StatCard label="Время (мин)" value={Math.round(totals.time / 60)} />
        <StatCard label="Клиентов" value={totals.clients} />
      </div>
      <Table>
        <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50">
          <tr>
            <th className="px-4 py-3">Период</th>
            <th className="px-4 py-3">Категория</th>
            <th className="px-4 py-3">Запуски</th>
            <th className="px-4 py-3">Время (сек)</th>
            <th className="px-4 py-3">Ср. время</th>
            <th className="px-4 py-3">Клиенты</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((s) => (
            <tr key={s.id} className="border-b border-slate-100 dark:border-slate-800">
              <td className="px-4 py-3">{periodLabel[s.period] || s.period}</td>
              <td className="px-4 py-3">{categoryLabel[s.category] || s.category}</td>
              <td className="px-4 py-3">{s.launchCount}</td>
              <td className="px-4 py-3">{s.usageTime}</td>
              <td className="px-4 py-3">{s.avgWashTime} сек</td>
              <td className="px-4 py-3">{s.clientCount}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
