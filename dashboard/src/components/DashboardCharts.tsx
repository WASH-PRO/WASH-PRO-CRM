import { useMemo } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
} from 'recharts';
import { useTheme } from '../context/ThemeContext';
import { categoryLabel } from './UI';
import { formatMoney, type CurrencyConfig } from '../utils/format';
import { latestUsageByPostAndCategory, resolveCategoryUsageSeconds } from '../utils/statsAggregation';
import type { FinanceStat, Post, UsageStat } from '../types';

const CATEGORY_COLORS = ['#0891b2', '#6366f1', '#0f766e'];

const usageChartLabel: Record<string, string> = {
  regular: 'Скидочные карты',
  service: categoryLabel.service,
  unlimited: categoryLabel.unlimited,
};

function formatUsageSeconds(seconds: number): string {
  if (seconds >= 3600) return `${(seconds / 3600).toFixed(1)} ч`;
  if (seconds >= 60) return `${Math.round(seconds / 60)} мин`;
  return `${seconds} сек`;
}

interface DashboardChartsProps {
  posts: Post[];
  usageStats: UsageStat[];
  financeStats: FinanceStat[];
  currency: CurrencyConfig;
  online: number;
  offline: number;
  maintenanceCount: number;
  errorCount: number;
}

function ChartCard({ title, children, empty }: { title: string; children: React.ReactNode; empty?: boolean }) {
  return (
    <div className="card">
      <h2 className="mb-4 font-semibold">{title}</h2>
      {empty ? (
        <p className="flex h-64 items-center justify-center text-sm text-panel-muted dark:text-panel-muted-dark sm:h-80">Нет данных для графика</p>
      ) : (
        <div className="h-64 sm:h-80">{children}</div>
      )}
    </div>
  );
}

export function DashboardCharts({
  posts,
  usageStats,
  financeStats,
  currency,
  online,
  offline,
  maintenanceCount,
  errorCount,
}: DashboardChartsProps) {
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

  const postStatusCards = [
    { label: 'Постов онлайн', value: online, color: 'text-emerald-600', bg: 'panel-stat', hint: 'данные за 30 сек' },
    { label: 'Постов офлайн', value: offline, color: 'text-panel-muted', bg: 'panel-stat', hint: 'нет данных > 30 сек' },
    { label: 'Постов в обслуживании', value: maintenanceCount, color: 'text-amber-600', bg: 'panel-stat' },
    { label: 'Постов в ошибке', value: errorCount, color: 'text-red-600', bg: 'panel-stat' },
  ];

  const usageByCategory = useMemo(() => {
    const latest = latestUsageByPostAndCategory(usageStats);
    const cats = ['regular', 'service', 'unlimited'] as const;
    return cats.map((category, i) => {
      const usageTime = resolveCategoryUsageSeconds(latest, category);
      return {
        name: usageChartLabel[category],
        value: usageTime,
        fill: CATEGORY_COLORS[i],
      };
    }).filter((x) => x.value > 0);
  }, [usageStats]);

  const revenueTimeline = useMemo(() => {
    const byDate: Record<string, { revenue: number; ts: number }> = {};
    financeStats.forEach((s) => {
      const ts = s.recordedAt ? new Date(s.recordedAt).getTime() : 0;
      const key = s.recordedAt
        ? new Date(s.recordedAt).toLocaleDateString('ru', { day: '2-digit', month: 'short' })
        : 'Текущий';
      if (!byDate[key]) byDate[key] = { revenue: 0, ts };
      byDate[key].revenue += s.totalRevenue || 0;
      byDate[key].ts = Math.max(byDate[key].ts, ts);
    });
    return Object.entries(byDate)
      .map(([name, { revenue, ts }]) => ({ name, revenue: Math.round(revenue), ts }))
      .sort((a, b) => a.ts - b.ts)
      .map(({ name, revenue }) => ({ name, revenue }));
  }, [financeStats]);

  const usageTotal = useMemo(
    () => usageByCategory.reduce((sum, item) => sum + item.value, 0),
    [usageByCategory]
  );

  return (
    <div className="mb-6 space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {postStatusCards.map((c) => (
          <div key={c.label} className={c.bg}>
            <div className="text-xs font-medium uppercase tracking-wide text-panel-muted dark:text-panel-muted-dark">{c.label}</div>
            <div className={`mt-2 text-3xl font-semibold tracking-tight ${c.color}`}>{c.value}</div>
            <div className="mt-1 text-xs text-panel-muted dark:text-panel-muted-dark">
              {c.hint ? c.hint : `из ${posts.length} постов`}
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Использование типов карт" empty={usageByCategory.length === 0}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
              <Pie
                data={usageByCategory}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius="42%"
                outerRadius="62%"
                paddingAngle={3}
              >
                {usageByCategory.map((entry) => (
                  <Cell key={entry.name} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(value: number, _name, item) => {
                  const percent = usageTotal ? ((value / usageTotal) * 100).toFixed(0) : '0';
                  const label = (item as { payload?: { name?: string } })?.payload?.name || 'Категория';
                  return [`${formatUsageSeconds(value)} · ${percent}%`, label];
                }}
              />
              <Legend
                verticalAlign="bottom"
                layout="horizontal"
                wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Выручка" empty={revenueTimeline.length === 0}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={revenueTimeline} margin={{ top: 8, right: 12, left: 4, bottom: 24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
              <XAxis dataKey="name" tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} width={56} />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(value: number) => [formatMoney(value, currency), 'Выручка']}
              />
              <Line type="monotone" dataKey="revenue" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}
