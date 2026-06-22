import { useEffect, useMemo, useState } from 'react';
import { apiList } from '../api/client';
import { PageHeader, Table, Loading, StatCard, periodLabel } from '../components/UI';
import type { FinanceStat } from '../types';

export function FinancePage() {
  const [stats, setStats] = useState<FinanceStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('all');

  useEffect(() => {
    apiList<FinanceStat>('/crm/finance-stats').then(setStats).finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(
    () => (period === 'all' ? stats : stats.filter((s) => s.period === period)),
    [stats, period]
  );

  const totals = useMemo(() => ({
    cash: filtered.reduce((s, x) => s + (x.cash || 0), 0),
    cashless: filtered.reduce((s, x) => s + (x.cashless || 0), 0),
    revenue: filtered.reduce((s, x) => s + (x.totalRevenue || 0), 0),
  }), [filtered]);

  if (loading) return <Loading />;

  return (
    <div>
      <PageHeader
        title="Финансовая статистика"
        subtitle="Наличные, безнал, скидки и выручка"
        actions={
          <select className="input w-auto" value={period} onChange={(e) => setPeriod(e.target.value)}>
            <option value="all">Все периоды</option>
            <option value="before_collection">До инкассации</option>
            <option value="after_collection">После инкассации</option>
          </select>
        }
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Наличные" value={`${totals.cash.toFixed(2)} ₽`} />
        <StatCard label="Безнал" value={`${totals.cashless.toFixed(2)} ₽`} />
        <StatCard label="Выручка" value={`${totals.revenue.toFixed(2)} ₽`} />
      </div>
      <Table>
        <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50">
          <tr>
            <th className="px-4 py-3">Период</th>
            <th className="px-4 py-3">Наличные</th>
            <th className="px-4 py-3">Безнал</th>
            <th className="px-4 py-3">Скидки</th>
            <th className="px-4 py-3">Выручка</th>
            <th className="px-4 py-3">Ср. чек</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((s) => (
            <tr key={s.id} className="border-b border-slate-100 dark:border-slate-800">
              <td className="px-4 py-3">{periodLabel[s.period] || s.period}</td>
              <td className="px-4 py-3">{s.cash?.toFixed(2)} ₽</td>
              <td className="px-4 py-3">{s.cashless?.toFixed(2)} ₽</td>
              <td className="px-4 py-3">{s.discountOps}</td>
              <td className="px-4 py-3 font-medium">{s.totalRevenue?.toFixed(2)} ₽</td>
              <td className="px-4 py-3">{s.avgCheck?.toFixed(2)} ₽</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
