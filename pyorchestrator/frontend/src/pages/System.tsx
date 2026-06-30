import { useCallback, useMemo } from "react";
import PageContainer, { PageContent } from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import Badge, { type BadgeTone } from "@/components/ui/Badge";
import MetricsStrip, { type MetricItem } from "@/components/ui/MetricsStrip";
import Panel from "@/components/ui/Panel";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { api } from "@/api/client";
import { useTranslation } from "@/context/LocaleContext";
import { cn } from "@/lib/cn";

interface SystemResources {
  memory_total_mb: number;
  memory_used_mb: number;
  memory_percent: number;
  disk_total_gb: number;
  disk_used_gb: number;
  disk_percent: number;
}

interface SystemInfo {
  name: string;
  version: string;
  environment: string;
  uptime_seconds: number;
  started_at: string;
  services: Record<string, string>;
  resources: SystemResources;
  config?: {
    minio_bucket?: string;
    minio_endpoint?: string;
    minio_console_url?: string;
  };
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatServiceStatus(status: string): string {
  if (status === "ok") return "OK";
  if (status === "configured") return "настроен";
  if (status.startsWith("error:")) return status.replace(/^error:\s*/, "");
  return status;
}

function serviceTone(status: string): BadgeTone {
  if (status === "ok" || status === "configured") return "success";
  if (status.startsWith("error")) return "danger";
  return "warning";
}

function usageTone(percent: number): MetricItem["tone"] {
  if (percent >= 90) return "danger";
  if (percent >= 75) return "warning";
  return "success";
}

function ResourceBar({
  label,
  used,
  total,
  unit,
  percent,
}: {
  label: string;
  used: number;
  total: number;
  unit: string;
  percent: number;
}) {
  const tone = usageTone(percent);
  const barColor =
    tone === "danger" ? "bg-red-400" : tone === "warning" ? "bg-amber-400" : "bg-emerald-400";

  return (
    <div className="rounded-xl bg-surface-muted/60 p-4 ring-1 ring-ring-line">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-faint">{label}</p>
          <p className="mt-1 text-sm font-semibold tabular-nums text-foreground">
            {used} / {total} {unit}
          </p>
        </div>
        <p
          className={cn(
            "text-2xl font-bold tabular-nums tracking-tight",
            tone === "danger" && "text-red-400",
            tone === "warning" && "text-amber-400",
            tone === "success" && "text-emerald-400",
          )}
        >
          {percent}%
        </p>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-inset">
        <div className={cn("h-full rounded-full transition-all", barColor)} style={{ width: `${Math.min(percent, 100)}%` }} />
      </div>
    </div>
  );
}

export default function SystemPage() {
  const { t } = useTranslation();

  const fetchInfo = useCallback(() => api<SystemInfo>("/api/v1/system/info"), []);
  const { data: info, reload, refreshing, lastUpdated } = useLiveQuery(fetchInfo, [], {
    intervalMs: 30_000,
  });

  const services = info?.services ?? {};
  const serviceEntries = Object.entries(services);
  const servicesOk = serviceEntries.filter(([, s]) => s === "ok" || s === "configured").length;
  const resources = info?.resources;

  const summary = useMemo<MetricItem[]>(
    () => [
      {
        label: t("system.cards.application.version"),
        value: info?.version ?? "—",
        tone: "accent",
      },
      {
        label: t("system.cards.application.uptime"),
        value: info ? formatUptime(info.uptime_seconds) : "—",
        tone: "success",
      },
      {
        label: t("system.cards.application.environment"),
        value: info?.environment ?? "—",
        hint: info?.name,
      },
      {
        label: t("system.resources.memory"),
        value: resources ? `${resources.memory_percent}%` : "—",
        hint: resources ? `${resources.memory_used_mb} / ${resources.memory_total_mb} MB` : undefined,
        tone: resources ? usageTone(resources.memory_percent) : "default",
      },
      {
        label: t("system.resources.disk"),
        value: resources ? `${resources.disk_percent}%` : "—",
        hint: resources ? `${resources.disk_used_gb} / ${resources.disk_total_gb} GB` : undefined,
        tone: resources ? usageTone(resources.disk_percent) : "default",
      },
      {
        label: t("system.cards.services.title"),
        value: `${servicesOk}/${serviceEntries.length}`,
        hint: t("system.cards.services.subtitle"),
        tone: servicesOk === serviceEntries.length ? "success" : "warning",
      },
    ],
    [info, resources, serviceEntries.length, servicesOk, t],
  );

  return (
    <PageContainer>
      <PageHeader
        title={t("system.title")}
        subtitle={t("system.subtitle")}
        onRefresh={reload}
        refreshing={refreshing}
        lastUpdated={lastUpdated}
      />

      <PageContent className="space-y-6">
        <MetricsStrip items={summary} />

        <Panel
          className="w-full"
          title={t("system.resources.title")}
          subtitle={t("system.resources.subtitle")}
          bodyClassName="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 sm:p-6"
        >
          <ResourceBar
            label={t("system.resources.memory")}
            used={resources?.memory_used_mb ?? 0}
            total={resources?.memory_total_mb ?? 0}
            unit="MB"
            percent={resources?.memory_percent ?? 0}
          />
          <ResourceBar
            label={t("system.resources.disk")}
            used={resources?.disk_used_gb ?? 0}
            total={resources?.disk_total_gb ?? 0}
            unit="GB"
            percent={resources?.disk_percent ?? 0}
          />
        </Panel>

        {info?.config?.minio_bucket ? (
          <Panel
            className="w-full"
            title={t("system.cards.storage.title")}
            subtitle={t("system.cards.storage.subtitle")}
            bodyClassName="grid grid-cols-1 gap-4 p-5 sm:grid-cols-3 sm:p-6"
          >
            <div className="rounded-xl bg-surface-muted/60 p-4 ring-1 ring-ring-line">
              <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-faint">
                {t("system.cards.storage.bucket")}
              </p>
              <p className="mt-1 font-mono text-sm text-foreground">{info.config.minio_bucket}</p>
            </div>
            <div className="rounded-xl bg-surface-muted/60 p-4 ring-1 ring-ring-line">
              <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-faint">
                {t("system.cards.storage.service")}
              </p>
              <p className="mt-1 font-mono text-sm text-foreground">
                {services.minio ? formatServiceStatus(services.minio) : "—"}
              </p>
            </div>
            {info.config.minio_console_url ? (
              <div className="rounded-xl bg-surface-muted/60 p-4 ring-1 ring-ring-line">
                <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-faint">
                  {t("system.cards.storage.console")}
                </p>
                <a
                  href={info.config.minio_console_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-block text-sm font-medium text-accent hover:underline"
                >
                  {info.config.minio_console_url}
                </a>
              </div>
            ) : null}
          </Panel>
        ) : null}

        <Panel
          className="w-full"
          title={t("system.cards.services.title")}
          subtitle={t("system.cards.services.subtitle")}
          bodyClassName="p-5 sm:p-6"
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {serviceEntries.map(([name, status]) => (
              <div
                key={name}
                className="flex items-center justify-between gap-3 rounded-xl bg-surface-muted/60 px-4 py-3 ring-1 ring-ring-line"
              >
                <span className="font-mono text-xs font-semibold uppercase tracking-wide text-muted">{name}</span>
                <Badge label={formatServiceStatus(status)} tone={serviceTone(status)} live={status === "ok"} />
              </div>
            ))}
          </div>
        </Panel>
      </PageContent>
    </PageContainer>
  );
}
