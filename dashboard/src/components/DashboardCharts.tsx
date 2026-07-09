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
import { buildDashboardPaymentShareSeries, buildDashboardUsageShareSeries, buildDashboardRevenueTimeline, buildDashboardWorkloadTimeline } from '../utils/statsAggregation';
import type { FinanceStat, Post, UsageStat } from '../types';
import { useLocale } from '../i18n/LocaleContext';

function formatUsageSeconds(seconds: number, t: (key: string, params?: Record<string, string | number>) => string): string {
  if (seconds >= 3600) return t('dashboardCharts.hoursShort', { value: (seconds / 3600).toFixed(1) });
  if (seconds >= 60) return t('dashboardCharts.minutesShort', { value: Math.round(seconds / 60) });
  return t('dashboardCharts.secondsShort', { value: seconds });
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

function ChartCard({
  title,
  children,
  empty,
  emptyMessage,
}: {
  title: string;
  children: React.ReactNode;
  empty?: boolean;
  emptyMessage: string;
}) {
  return (
    <div className="card">
      <h2 className="mb-4 font-semibold">{title}</h2>
      {empty ? (
        <p className="flex h-64 items-center justify-center text-sm text-panel-muted dark:text-panel-muted-dark sm:h-80">{emptyMessage}</p>
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
  const { t, locale } = useLocale();
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
    { label: t('dashboardCharts.postsOnline'), value: online, color: 'text-emerald-600', bg: 'panel-stat', hint: t('dashboardCharts.onlineHint') },
    { label: t('dashboardCharts.postsOffline'), value: offline, color: 'text-panel-muted', bg: 'panel-stat', hint: t('dashboardCharts.offlineHint') },
    { label: t('dashboardCharts.postsMaintenance'), value: maintenanceCount, color: 'text-amber-600', bg: 'panel-stat' },
    { label: t('dashboardCharts.postsError'), value: errorCount, color: 'text-red-600', bg: 'panel-stat' },
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

  const revenueTimeline = useMemo(
    () =>
      buildDashboardRevenueTimeline(financeStats, locale, t('dashboardCharts.current')).map(({ name, value }) => ({
        name,
        revenue: value,
      })),
    [financeStats, locale, t]
  );

  const workloadTimeline = useMemo(
    () =>
      buildDashboardWorkloadTimeline(usageStats, locale, t('dashboardCharts.current')).map(({ name, value }) => ({
        name,
        workload: value,
      })),
    [usageStats, locale, t]
  );

  return (
    <div className="mb-6 space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {postStatusCards.map((c) => (
          <div key={c.label} className={c.bg}>
            <div className="text-xs font-medium uppercase tracking-wide text-panel-muted dark:text-panel-muted-dark">{c.label}</div>
            <div className={`mt-2 text-3xl font-semibold tracking-tight ${c.color}`}>{c.value}</div>
            <div className="mt-1 text-xs text-panel-muted dark:text-panel-muted-dark">
              {c.hint ? c.hint : t('dashboardCharts.outOfPosts', { count: posts.length })}
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title={t('dashboardCharts.usageTitle')} empty={usageShareTotal <= 0} emptyMessage={t('dashboardCharts.empty')}>
          <ShareDonutChart
            data={usageShare}
            total={usageShareTotal}
            axisColor={axisColor}
            tooltipStyle={tooltipStyle}
            formatValue={(value, total) => {
              const pct = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
              return `${formatUsageSeconds(value, t)} (${pct}%)`;
            }}
          />
        </ChartCard>

        <ChartCard title={t('dashboardCharts.paymentShareTitle')} empty={paymentShareTotal <= 0} emptyMessage={t('dashboardCharts.empty')}>
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
          <ChartCard title={t('dashboardCharts.revenueTitle')} empty={revenueTimeline.length === 0} emptyMessage={t('dashboardCharts.empty')}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenueTimeline} margin={{ top: 8, right: 12, left: 4, bottom: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis dataKey="name" tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} width={56} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value: number) => [formatMoney(value, currency), t('dashboardCharts.revenueTitle')]}
                />
                <Line type="monotone" dataKey="revenue" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        <div className="lg:col-span-2">
          <ChartCard title={t('dashboardCharts.workloadTitle')} empty={workloadTimeline.length === 0} emptyMessage={t('dashboardCharts.empty')}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={workloadTimeline} margin={{ top: 8, right: 12, left: 4, bottom: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis dataKey="name" tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fill: axisColor, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={56}
                  tickFormatter={(value: number) => formatUsageSeconds(value, t)}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value: number) => [formatUsageSeconds(value, t), t('dashboardCharts.workloadTitle')]}
                />
                <Line type="monotone" dataKey="workload" stroke="#0891b2" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </div>
    </div>
  );
}
