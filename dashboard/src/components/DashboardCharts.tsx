import { useMemo } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { useTheme } from '../context/ThemeContext';
import { categoryLabel, statusLabel } from './UI';
import type { FinanceStat, Post, UsageStat } from '../types';

const STATUS_COLORS: Record<string, string> = {
  online: '#10b981',
  offline: '#64748b',
  error: '#ef4444',
  maintenance: '#f59e0b',
};

const CATEGORY_COLORS = ['#14b8a6', '#3b82f6', '#8b5cf6'];

interface DashboardChartsProps {
  posts: Post[];
  usageStats: UsageStat[];
  financeStats: FinanceStat[];
}

function ChartCard({ title, children, empty }: { title: string; children: React.ReactNode; empty?: boolean }) {
  return (
    <div className="card">
      <h2 className="mb-4 font-semibold">{title}</h2>
      {empty ? (
        <p className="flex h-56 items-center justify-center text-sm text-slate-500">Нет данных для графика</p>
      ) : (
        <div className="h-56">{children}</div>
      )}
    </div>
  );
}

export function DashboardCharts({ posts, usageStats, financeStats }: DashboardChartsProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const gridColor = isDark ? '#334155' : '#e2e8f0';
  const axisColor = isDark ? '#94a3b8' : '#64748b';
  const tooltipStyle = {
    backgroundColor: isDark ? '#0f172a' : '#fff',
    border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
    borderRadius: '8px',
    fontSize: '12px',
  };

  const postStatusData = useMemo(() => {
    const counts: Record<string, number> = { online: 0, offline: 0, error: 0, maintenance: 0 };
    posts.forEach((p) => {
      counts[p.status] = (counts[p.status] || 0) + 1;
    });
    return Object.entries(counts)
      .filter(([, value]) => value > 0)
      .map(([status, value]) => ({
        name: statusLabel[status] || status,
        value,
        color: STATUS_COLORS[status] || '#94a3b8',
      }));
  }, [posts]);

  const revenueData = useMemo(() => {
    const cash = financeStats.reduce((s, x) => s + (x.cash || 0), 0);
    const cashless = financeStats.reduce((s, x) => s + (x.cashless || 0), 0);
    const revenue = financeStats.reduce((s, x) => s + (x.totalRevenue || 0), 0);
    return [
      { name: 'Наличные', value: Math.round(cash), fill: '#14b8a6' },
      { name: 'Безнал', value: Math.round(cashless), fill: '#3b82f6' },
      { name: 'Выручка', value: Math.round(revenue), fill: '#8b5cf6' },
    ].filter((x) => x.value > 0);
  }, [financeStats]);

  const usageByCategory = useMemo(() => {
    const byCategory: Record<string, number> = {};
    usageStats.forEach((s) => {
      const key = s.category || 'other';
      byCategory[key] = (byCategory[key] || 0) + (s.launchCount || 0);
    });
    return Object.entries(byCategory).map(([category, launches], i) => ({
      name: categoryLabel[category] || category,
      launches,
      fill: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
    }));
  }, [usageStats]);

  return (
    <div className="mb-6 grid gap-6 lg:grid-cols-3">
      <ChartCard title="Статус постов" empty={postStatusData.length === 0}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={postStatusData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={2}
            >
              {postStatusData.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(value: number) => [value, 'Постов']}
            />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Выручка" empty={revenueData.length === 0}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={revenueData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
            <XAxis dataKey="name" tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} width={48} />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(value: number) => [`${value.toLocaleString('ru-RU')} ₽`, '']}
            />
            <Bar dataKey="value" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Запуски по категориям" empty={usageByCategory.length === 0}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={usageByCategory} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fill: axisColor, fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              interval={0}
              angle={-12}
              textAnchor="end"
              height={48}
            />
            <YAxis tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
            <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [value, 'Запусков']} />
            <Bar dataKey="launches" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
