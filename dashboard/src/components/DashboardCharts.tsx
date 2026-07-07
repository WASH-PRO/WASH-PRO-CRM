import { useMemo } from 'react';
import {
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { useTheme } from '../context/ThemeContext';
import { formatMoney, type CurrencyConfig } from '../utils/format';
import { buildDashboardPaymentShareSeries, buildDashboardUsageShareSeries } from '../utils/statsAggregation';
import type { FinanceStat, Post, UsageStat } from '../types';

function formatUsageSeconds(seconds: number): string {
  if (seconds >= 3600) return `${(seconds / 3600).toFixed(1)} ч`;
  if (seconds >= 60) return `${Math.round(seconds / 60)} мин`;
  return `${seconds} сек`;
}

interface ShareSlice {
  key: string;
  name: string;
  value: number;
  fill: string;
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

function ShareDonutChart({
  data,
  total,
  axisColor,
  tooltipStyle,
  formatValue,
}: {
  data: ShareSlice[];
  total: number;
  axisColor: string;
  tooltipStyle: React.CSSProperties;
  formatValue: (value: number, total: number) => string;
}) {
  const visible = data.filter((item) => item.value > 0);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
        <Pie
          data={visible}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="48%"
          innerRadius={56}
          outerRadius={92}
          paddingAngle={2}
        >
          {visible.map((entry) => (
            <Cell key={entry.key} fill={entry.fill} stroke="transparent" />
          ))}
        </Pie>
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(value: number, name: string) => [formatValue(value, total), name]}
        />
        <Legend
          verticalAlign="bottom"
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: '11px', color: axisColor, paddingTop: '8px' }}
        />
      </PieChart>
    </ResponsiveContainer>
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

  const usageShare = useMemo(
    () => buildDashboardUsageShareSeries(usageStats),
    [usageStats]
  );

  const usageShareTotal = useMemo(
    () => usageShare.reduce((sum, item) => sum + item.value, 0),
    [usageShare]
  );

  const paymentShare = useMemo(
    () => buildDashboardPaymentShareSeries(financeStats),
    [financeStats]
  );

  const paymentShareTotal = useMemo(
    () => paymentShare.reduce((sum, item) => sum + item.value, 0),
    [paymentShare]
  );

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
        <ChartCard title="Использование" empty={usageShareTotal <= 0}>
          <ShareDonutChart
            data={usageShare}
            total={usageShareTotal}
            axisColor={axisColor}
            tooltipStyle={tooltipStyle}
            formatValue={(value, total) => {
              const pct = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
              return `${formatUsageSeconds(value)} (${pct}%)`;
            }}
          />
        </ChartCard>

        <ChartCard title="Доли поступлений" empty={paymentShareTotal <= 0}>
          <ShareDonutChart
            data={paymentShare}
            total={paymentShareTotal}
            axisColor={axisColor}
            tooltipStyle={tooltipStyle}
            formatValue={(value, total) => {
              const pct = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
              return `${formatMoney(value, currency)} (${pct}%)`;
            }}
          />
        </ChartCard>

        <div className="lg:col-span-2">
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
    </div>
  );
}
