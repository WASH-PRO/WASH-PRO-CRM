import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  Brush,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import clsx from 'clsx';
import { useTheme } from '../context/ThemeContext';
import { formatDurationHuman, formatMoney, type CurrencyConfig } from '../utils/format';
import { useLocale } from '../i18n/LocaleContext';

export interface PostStateChartRow {
  postId: string;
  address: string;
  postNumber: number;
  balance?: number;
  discount?: number;
  freePause?: number;
  modeTime?: number;
  modeName?: string;
  hasData: boolean;
  fetchedAt: number;
}

type Metric = 'modeTime' | 'balance' | 'freePause';

function getMetricOptions(t: (key: string, params?: Record<string, string | number>) => string): { id: Metric; label: string }[] {
  return [
    { id: 'modeTime', label: t('postStatesChart.metric.modeTime') },
    { id: 'balance', label: t('postStatesChart.metric.balance') },
    { id: 'freePause', label: t('postStatesChart.metric.freePause') },
  ];
}

function liveModeSeconds(row: PostStateChartRow, now: number): number {
  if (!row.hasData || row.modeTime == null) return 0;
  return row.modeTime + Math.floor((now - row.fetchedAt) / 1000);
}

function shortAddress(address: string, max = 18): string {
  if (address.length <= max) return address;
  return `${address.slice(0, max - 1)}…`;
}

function metricValue(row: PostStateChartRow, metric: Metric, now: number): number {
  switch (metric) {
    case 'modeTime':
      return liveModeSeconds(row, now) / 60;
    case 'balance':
      return row.hasData && row.balance != null ? row.balance : 0;
    case 'freePause':
      return row.hasData && row.freePause != null ? row.freePause / 60 : 0;
    default:
      return 0;
  }
}

function metricAxisLabel(
  metric: Metric,
  currency: CurrencyConfig,
  t: (key: string, params?: Record<string, string | number>) => string
): string {
  switch (metric) {
    case 'modeTime':
      return t('postStatesChart.minutesShort');
    case 'balance':
      return currency.symbol || currency.code;
    case 'freePause':
      return t('postStatesChart.minutesShort');
    default:
      return '';
  }
}

function formatMetricValue(value: number, metric: Metric, currency: CurrencyConfig): string {
  switch (metric) {
    case 'modeTime':
      return formatDurationHuman(Math.round(value * 60));
    case 'balance':
      return formatMoney(value, currency);
    case 'freePause':
      return formatDurationHuman(Math.round(value * 60));
    default:
      return '';
  }
}

interface ChartPoint {
  postId: string;
  label: string;
  fullLabel: string;
  value: number;
  hasData: boolean;
  modeName?: string;
  balance?: number;
  discount?: number;
  liveModeSec: number;
  freePauseSec?: number;
}

interface PostStatesChartProps {
  rows: PostStateChartRow[];
  currency: CurrencyConfig;
}

export function PostStatesChart({ rows, currency }: PostStatesChartProps) {
  const { t } = useLocale();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [metric, setMetric] = useState<Metric>('modeTime');
  const [now, setNow] = useState(() => Date.now());
  const [activePostId, setActivePostId] = useState<string | null>(null);
  const metricOptions = useMemo(() => getMetricOptions(t), [t]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const gridColor = isDark ? '#334155' : '#e2e8f0';
  const axisColor = isDark ? '#94a3b8' : '#64748b';
  const tooltipStyle = {
    backgroundColor: isDark ? '#0f172a' : '#fff',
    border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
    borderRadius: '8px',
    fontSize: '12px',
  };

  const activeCount = rows.filter((r) => r.hasData).length;

  const chartData = useMemo((): ChartPoint[] => {
    return [...rows]
      .sort((a, b) => {
        const addr = a.address.localeCompare(b.address, undefined);
        return addr !== 0 ? addr : a.postNumber - b.postNumber;
      })
      .map((row) => ({
        postId: row.postId,
        label: `${shortAddress(row.address)} · #${row.postNumber}`,
        fullLabel: t('postStatesChart.postLabel', { address: row.address, number: row.postNumber }),
        value: metricValue(row, metric, now),
        hasData: row.hasData,
        modeName: row.modeName,
        balance: row.balance,
        discount: row.discount,
        liveModeSec: liveModeSeconds(row, now),
        freePauseSec: row.freePause,
      }));
  }, [rows, metric, now]);

  const showBrush = chartData.length > 14;
  const brushStart = showBrush ? Math.max(0, chartData.length - 14) : 0;

  return (
    <div className="card mb-6">
      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-semibold text-panel-ink dark:text-panel-ink-dark">{t('postStatesChart.title')}</h2>
          <p className="mt-1 text-sm text-panel-muted dark:text-panel-muted-dark">
            {t('postStatesChart.subtitle', { active: activeCount, total: rows.length })}
          </p>
        </div>
        <div className="flex flex-wrap gap-1 rounded-lg border border-panel-border p-1 dark:border-panel-border-dark">
          {metricOptions.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setMetric(opt.id)}
              className={clsx(
                'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                metric === opt.id
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-panel-muted hover:bg-slate-100 dark:text-panel-muted-dark dark:hover:bg-slate-800'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="flex h-72 items-center justify-center text-sm text-panel-muted dark:text-panel-muted-dark">
          {t('postStatesChart.empty')}
        </p>
      ) : (
        <div className="h-[22rem] w-full sm:h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 8, right: 8, left: 4, bottom: showBrush ? 48 : 56 }}
              onMouseLeave={() => setActivePostId(null)}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: axisColor, fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                interval={0}
                angle={-35}
                textAnchor="end"
                height={56}
              />
              <YAxis
                tick={{ fill: axisColor, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={48}
                label={{
                  value: metricAxisLabel(metric, currency, t),
                  angle: -90,
                  position: 'insideLeft',
                  fill: axisColor,
                  fontSize: 11,
                  offset: 12,
                }}
              />
              <Tooltip
                cursor={{ fill: isDark ? 'rgba(148,163,184,0.12)' : 'rgba(148,163,184,0.2)' }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const row = payload[0]?.payload as ChartPoint;
                  if (!row) return null;
                  return (
                    <div style={tooltipStyle} className="px-3 py-2 shadow-panel">
                      <div className="mb-2 font-medium">{row.fullLabel}</div>
                      <div className="space-y-1 text-panel-muted dark:text-panel-muted-dark">
                        <div>
                          <span className="text-panel-ink dark:text-panel-ink-dark">{metricOptions.find((m) => m.id === metric)?.label ?? t('postStatesChart.value')}: </span>
                          {formatMetricValue(row.value, metric, currency)}
                        </div>
                        <div>{t('postStatesChart.mode')}: {row.hasData ? (row.modeName ?? '—') : t('postStatesChart.waitingData')}</div>
                        {row.balance != null && (
                          <div>{t('postStatesChart.balance')}: {formatMoney(row.balance, currency)}</div>
                        )}
                        {row.discount != null && (
                          <div>{t('postStatesChart.discount')}: {formatMoney(row.discount, currency)}</div>
                        )}
                        {row.liveModeSec > 0 && (
                          <div>{t('postStatesChart.metric.modeTime')}: {formatDurationHuman(row.liveModeSec)}</div>
                        )}
                        {row.freePauseSec != null && row.freePauseSec > 0 && (
                          <div>{t('postStatesChart.metric.freePause')}: {formatDurationHuman(row.freePauseSec)}</div>
                        )}
                      </div>
                    </div>
                  );
                }}
              />
              <Bar
                dataKey="value"
                radius={[4, 4, 0, 0]}
                maxBarSize={48}
                onMouseEnter={({ postId }: ChartPoint) => setActivePostId(postId)}
              >
                {chartData.map((entry) => (
                  <Cell
                    key={entry.postId}
                    fill={
                      activePostId === entry.postId
                        ? '#0891b2'
                        : entry.hasData
                          ? isDark
                            ? '#22d3ee'
                            : '#0891b2'
                          : isDark
                            ? '#475569'
                            : '#cbd5e1'
                    }
                    fillOpacity={entry.hasData ? 1 : 0.55}
                  />
                ))}
              </Bar>
              {showBrush && (
                <Brush
                  dataKey="label"
                  height={28}
                  stroke={isDark ? '#64748b' : '#94a3b8'}
                  fill={isDark ? '#1e293b' : '#f1f5f9'}
                  startIndex={brushStart}
                  endIndex={chartData.length - 1}
                  travellerWidth={8}
                />
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
