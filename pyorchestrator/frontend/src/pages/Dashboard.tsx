import { useCallback, useMemo } from "react";
import { ArrowTopRightOnSquareIcon } from "@heroicons/react/20/solid";
import PageContainer, { Col, PageContent, PageGrid } from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import DashboardAreaChart, { type ChartSeries } from "@/components/ui/DashboardAreaChart";
import { StatusRow } from "@/components/ui/Badge";
import MetricBars from "@/components/ui/MetricBars";
import MetricsStrip, { MetricFooter, MetricInline, type MetricItem } from "@/components/ui/MetricsStrip";
import Panel from "@/components/ui/Panel";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { api } from "@/api/client";
import { useTranslation } from "@/context/LocaleContext";

interface Stats {
  total_scripts: number;
  active_scripts: number;
  stopped_scripts: number;
  errors_24h: number;
  completed_tasks: number;
  active_cron_jobs: number;
  running_now: number;
}

interface Timeseries {
  labels: string[];
  runs: number[];
  errors: number[];
  successes: number[];
  load: number[];
  schedules: number[];
  cpu: number[];
  memory_mb: number[];
  network: number[];
  disk_io: number[];
}

interface Script {
  script_type: string;
}

interface ChartGroupSpec {
  key: string;
  titleKey: string;
  subtitleKey: string;
  series: { dataKey: keyof Timeseries; labelKey: string; color: string }[];
  footer: (ts: Timeseries) => { label: string; value: string | number }[];
}

function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

function last(values: number[]): number {
  return values.length ? values[values.length - 1] : 0;
}

function buildChartData(ts: Timeseries, keys: (keyof Timeseries)[]): Record<string, string | number>[] {
  return ts.labels.map((hour, i) => {
    const row: Record<string, string | number> = { hour };
    for (const key of keys) {
      if (key === "labels") continue;
      row[key] = (ts[key] as number[])[i] ?? 0;
    }
    return row;
  });
}

function CombinedChartPanel({
  title,
  subtitle,
  data,
  series,
  footer,
}: {
  title: string;
  subtitle: string;
  data: Record<string, string | number>[];
  series: ChartSeries[];
  footer?: { label: string; value: string | number }[];
}) {
  return (
    <Panel className="h-full" title={title} subtitle={subtitle} flush bodyClassName="flex flex-1 flex-col px-5 pb-5 pt-4">
      <div className="min-h-[220px] flex-1">
        <DashboardAreaChart data={data} series={series} />
      </div>
      {footer && footer.length > 0 && (
        <MetricFooter>
          {footer.map((item) => (
            <MetricInline key={item.label} label={item.label} value={item.value} />
          ))}
        </MetricFooter>
      )}
    </Panel>
  );
}

export default function Dashboard() {
  const { t } = useTranslation();

  const fetchDashboard = useCallback(
    () =>
      Promise.all([
        api<Stats>("/api/v1/dashboard/stats"),
        api<Timeseries>("/api/v1/dashboard/timeseries"),
        api<Script[]>("/api/v1/scripts"),
        api<{ config?: { grafana_url?: string } }>("/api/v1/system/info"),
      ]),
    [],
  );

  const { data, reload, refreshing, lastUpdated } = useLiveQuery(fetchDashboard, []);

  const stats = data?.[0] ?? null;
  const timeseries = data?.[1] ?? null;
  const scripts = data?.[2] ?? [];
  const grafanaUrl = data?.[3]?.config?.grafana_url;

  const s = stats ?? {
    total_scripts: 0,
    active_scripts: 0,
    stopped_scripts: 0,
    errors_24h: 0,
    completed_tasks: 0,
    active_cron_jobs: 0,
    running_now: 0,
  };

  const ts: Timeseries = timeseries ?? {
    labels: [],
    runs: [],
    errors: [],
    successes: [],
    load: [],
    schedules: [],
    cpu: [],
    memory_mb: [],
    network: [],
    disk_io: [],
  };

  const metrics = useMemo<MetricItem[]>(
    () => [
      { label: t("dashboard.metrics.totalAssets"), value: s.total_scripts, hint: t("dashboard.metrics.totalAssetsHint"), tone: "accent" },
      { label: t("dashboard.metrics.active"), value: s.active_scripts, hint: t("dashboard.metrics.activeHint"), tone: "success" },
      { label: t("dashboard.metrics.running"), value: s.running_now, hint: t("dashboard.metrics.runningHint"), tone: "accent" },
      { label: t("dashboard.metrics.completed"), value: s.completed_tasks, hint: t("dashboard.metrics.completedHint"), tone: "default" },
      { label: t("dashboard.metrics.scheduled"), value: s.active_cron_jobs, hint: t("dashboard.metrics.scheduledHint"), tone: "default" },
      { label: t("dashboard.metrics.errors24h"), value: s.errors_24h, hint: t("dashboard.metrics.errors24hHint"), tone: s.errors_24h > 0 ? "danger" : "default" },
    ],
    [s, t],
  );

  const distribution = useMemo(() => {
    const counts = { script: 0, bot: 0 };
    scripts.forEach((sc) => {
      counts[sc.script_type as keyof typeof counts] += 1;
    });
    return [
      { label: t("common.script"), value: counts.script, color: "#22d3ee" },
      { label: t("common.bots"), value: counts.bot, color: "#34d399" },
      { label: t("common.cronJobs"), value: s.active_cron_jobs, color: "#818cf8" },
      { label: t("common.stopped"), value: s.stopped_scripts, color: "#71717a" },
    ];
  }, [scripts, s, t]);

  const chartGroups = useMemo<ChartGroupSpec[]>(
    () => [
      {
        key: "execution",
        titleKey: "dashboard.charts.execution.title",
        subtitleKey: "dashboard.charts.execution.subtitle",
        series: [
          { dataKey: "runs", labelKey: "dashboard.charts.runs.title", color: "#0891b2" },
          { dataKey: "errors", labelKey: "dashboard.charts.errors.title", color: "#ef4444" },
          { dataKey: "successes", labelKey: "dashboard.charts.successes.title", color: "#10b981" },
        ],
        footer: (series) => [
          { label: t("dashboard.charts.runs.title"), value: sum(series.runs) },
          { label: t("dashboard.charts.errors.title"), value: sum(series.errors) },
          { label: t("dashboard.charts.successes.title"), value: sum(series.successes) },
        ],
      },
      {
        key: "capacity",
        titleKey: "dashboard.charts.capacity.title",
        subtitleKey: "dashboard.charts.capacity.subtitle",
        series: [
          { dataKey: "load", labelKey: "dashboard.charts.load.title", color: "#8b5cf6" },
          { dataKey: "schedules", labelKey: "dashboard.charts.schedules.title", color: "#06b6d4" },
        ],
        footer: (series) => [
          { label: t("dashboard.metrics.running"), value: s.running_now },
          { label: t("dashboard.charts.peak24h"), value: Math.max(...series.load, 0) },
          { label: t("dashboard.charts.total24h"), value: sum(series.schedules) },
        ],
      },
      {
        key: "resources",
        titleKey: "dashboard.charts.resources.title",
        subtitleKey: "dashboard.charts.resources.subtitle",
        series: [
          { dataKey: "cpu", labelKey: "dashboard.charts.cpu.title", color: "#f59e0b" },
          { dataKey: "memory_mb", labelKey: "dashboard.charts.memory.title", color: "#a78bfa" },
        ],
        footer: (series) => [
          { label: t("dashboard.charts.avg24h"), value: `${(sum(series.cpu) / Math.max(series.cpu.length, 1)).toFixed(1)}%` },
          { label: t("dashboard.charts.peak24h"), value: `${Math.max(...series.memory_mb, 0)} MB` },
        ],
      },
      {
        key: "io",
        titleKey: "dashboard.charts.io.title",
        subtitleKey: "dashboard.charts.io.subtitle",
        series: [
          { dataKey: "network", labelKey: "dashboard.charts.network.title", color: "#2dd4bf" },
          { dataKey: "disk_io", labelKey: "dashboard.charts.disk.title", color: "#fb923c" },
        ],
        footer: (series) => [
          { label: t("dashboard.charts.avg24h"), value: (sum(series.network) / Math.max(series.network.length, 1)).toFixed(1) },
          { label: t("dashboard.charts.lastHour"), value: last(series.disk_io) },
        ],
      },
    ],
    [s.running_now, t],
  );

  return (
    <PageContainer>
      <PageHeader
        title={t("nav.overview")}
        subtitle={t("dashboard.subtitle")}
        onRefresh={reload}
        refreshing={refreshing}
        lastUpdated={lastUpdated}
      />

      <PageContent>
        <MetricsStrip items={metrics} />

        <PageGrid className="items-stretch">
          {chartGroups.map((group) => {
            const seriesKeys = group.series.map((s) => s.dataKey);
            const chartData = buildChartData(ts, seriesKeys);
            const chartSeries: ChartSeries[] = group.series.map((s) => ({
              dataKey: s.dataKey,
              label: t(s.labelKey),
              color: s.color,
            }));

            return (
              <Col key={group.key} span={6}>
                <CombinedChartPanel
                  title={t(group.titleKey)}
                  subtitle={t(group.subtitleKey)}
                  data={chartData}
                  series={chartSeries}
                  footer={group.footer?.(ts)}
                />
              </Col>
            );
          })}

          <Col span={grafanaUrl ? 4 : 6}>
            <Panel className="h-full" title={t("dashboard.health.title")} bodyClassName="flex flex-1 flex-col">
              <StatusRow label={t("dashboard.health.activeScripts")} value={s.active_scripts} tone="success" />
              <StatusRow label={t("dashboard.health.runningSandboxes")} value={s.running_now} tone={s.running_now > 0 ? "accent" : "neutral"} />
              <StatusRow label={t("dashboard.health.scheduledTasks")} value={s.active_cron_jobs} tone="neutral" />
              <StatusRow label={t("dashboard.health.failures24h")} value={s.errors_24h} tone={s.errors_24h > 0 ? "danger" : "success"} />
            </Panel>
          </Col>

          <Col span={grafanaUrl ? 4 : 6}>
            <Panel className="h-full" title={t("dashboard.assetMix.title")} bodyClassName="flex flex-1 flex-col justify-center">
              <MetricBars items={distribution} />
            </Panel>
          </Col>

          {grafanaUrl ? (
            <Col span={4}>
              <Panel className="h-full" title={t("dashboard.observability.title")} bodyClassName="flex flex-1 flex-col justify-between">
                <p className="text-sm leading-relaxed text-muted">{t("dashboard.observability.description")}</p>
                <a
                  href={grafanaUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex w-fit items-center gap-2 rounded-lg bg-cyan-400/10 px-4 py-2.5 text-sm font-semibold text-cyan-400 ring-1 ring-inset ring-cyan-400/20 transition-colors hover:bg-cyan-400/15"
                >
                  {t("dashboard.observability.openGrafana")}
                  <ArrowTopRightOnSquareIcon className="size-4" />
                </a>
              </Panel>
            </Col>
          ) : null}
        </PageGrid>
      </PageContent>
    </PageContainer>
  );
}
