import { useCallback, useMemo, useState, type ReactNode } from 'react';
import {
  Server,
  Cpu,
  HardDrive,
  MemoryStick,
  Layers,
  Network,
  Clock,
  Monitor,
  RefreshCw,
  type LucideIcon,
} from 'lucide-react';
import clsx from 'clsx';
import { api } from '../api/client';
import { componentById, getUpdatesStatus } from '../api/updates';
import { PageHeader, Loading, ErrorMessage, Badge, Table } from '../components/UI';
import { LIVE_INTERVAL_SYSTEM_MS } from '../constants/live';
import { usePolling } from '../hooks/usePolling';
import { useLocale } from '../i18n/LocaleContext';
import { formatBytes, formatUptime } from '../utils/format';
import type { SystemInfo } from '../types';
import type { UpdatesStatus } from '../api/updates';

interface SystemPageData {
  info: SystemInfo;
  updates: UpdatesStatus | null;
}

function InfoCard({
  icon: Icon,
  label,
  value,
  sub,
  color = '#3b82f6',
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="panel-stat">
      <div className="mb-3 flex items-start justify-between">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${color}18`, color }}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-panel-muted dark:text-panel-muted-dark">
        {label}
      </p>
      <p className="mt-2 font-display text-xl font-semibold tracking-tight text-panel-ink dark:text-panel-ink-dark">
        {value}
      </p>
      {sub && <p className="mt-1 text-xs text-panel-muted dark:text-panel-muted-dark">{sub}</p>}
    </div>
  );
}

function ProgressBar({ percent, color }: { percent: number; color: string }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-panel-canvas dark:bg-[#0d1218]">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${Math.min(percent, 100)}%`, backgroundColor: color }}
      />
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="shrink-0 text-panel-muted dark:text-panel-muted-dark">{label}</span>
      <span className="min-w-0 text-right">{value}</span>
    </div>
  );
}

function DetailRowMultiline({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1 text-sm">
      <p className="text-panel-muted dark:text-panel-muted-dark">{label}</p>
      <p className="break-words font-medium leading-snug text-panel-ink dark:text-panel-ink-dark">{value}</p>
    </div>
  );
}

function displayCpuModel(info: SystemInfo, fallback: string): string {
  const model = info.cpuModel?.trim();
  if (model && model !== 'Unknown') return model;
  return info.architecture || info.platform || fallback;
}

function washAppVersion(updates: UpdatesStatus | null): string {
  const fromUpdates = componentById(updates, 'crm')?.currentVersion?.trim();
  if (fromUpdates && fromUpdates !== '0.0.0') return fromUpdates;
  const fromBuild = import.meta.env.VITE_APP_VERSION?.trim();
  if (fromBuild) return fromBuild;
  return '—';
}

function platformLabel(info: SystemInfo): string {
  if (info.platform === 'linux') return `Docker · ${info.architecture}`;
  return `${info.platform} · ${info.architecture}`;
}

function formatCpuSpeed(speed: number, unknownLabel: string): string {
  return speed > 0 ? `${speed} MHz` : unknownLabel;
}

export function SystemPage() {
  const { t } = useLocale();
  const [networkSearch, setNetworkSearch] = useState('');

  const fetchData = useCallback(async (): Promise<SystemPageData> => {
    const info = await api<SystemInfo>('/dashboard/system');
    let updates: UpdatesStatus | null = null;
    try {
      updates = await getUpdatesStatus(false);
    } catch {
      updates = null;
    }
    return { info, updates };
  }, []);

  const { data, loading, error, refresh } = usePolling(fetchData, [], {
    intervalMs: LIVE_INTERVAL_SYSTEM_MS,
  });

  const info = data?.info;
  const updates = data?.updates ?? null;

  const filteredInterfaces = useMemo(() => {
    if (!info) return [];
    const q = networkSearch.trim().toLowerCase();
    if (!q) return info.network.interfaces;
    return info.network.interfaces.filter(
      (iface) =>
        iface.name.toLowerCase().includes(q) ||
        iface.address.toLowerCase().includes(q) ||
        iface.family.toLowerCase().includes(q)
    );
  }, [info, networkSearch]);

  if (loading && !info) return <Loading />;
  if (error && !info) return <ErrorMessage message={error} />;
  if (!info) return <ErrorMessage message={t('pages.system.loadFailed')} />;

  const cpuModelLabel = displayCpuModel(info, t('common.notAvailable'));
  const crmVersion = washAppVersion(updates);
  const dynamicApi = componentById(updates, 'dynamic-api');
  const pyorch = componentById(updates, 'pyorchestrator');
  const dynamicApiVersion = dynamicApi?.currentVersion && dynamicApi.currentVersion !== '0.0.0'
    ? dynamicApi.currentVersion
    : info.appVersion;
  const pyorchVersion = pyorch?.currentVersion && pyorch.currentVersion !== '0.0.0'
    ? pyorch.currentVersion
    : null;

  return (
    <div className="page-shell">
      <PageHeader
        title={t('pages.system.title')}
        subtitle={t('pages.system.subtitle')}
        actions={
          <button type="button" className="btn-secondary" onClick={() => refresh()}>
            <RefreshCw className="h-4 w-4" />
            {t('common.refresh')}
          </button>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <InfoCard
          icon={Monitor}
          label={t('pages.system.cards.os')}
          value={info.osType}
          sub={info.osRelease}
          color="#8b5cf6"
        />
        <InfoCard
          icon={Cpu}
          label={t('pages.system.cards.cpu')}
          value={t('pages.system.cards.cpuCores', { count: info.cpuCores })}
          sub={cpuModelLabel}
          color="#f59e0b"
        />
        <InfoCard
          icon={Server}
          label={t('pages.system.cards.hostname')}
          value={info.hostname}
          sub={info.architecture}
          color="#3b82f6"
        />
        <InfoCard
          icon={Clock}
          label={t('pages.system.cards.uptime')}
          value={formatUptime(info.uptime)}
          sub={t('pages.system.cards.server')}
          color="#10b981"
        />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card">
          <div className="mb-4 flex items-center gap-2">
            <MemoryStick className="h-4 w-4 text-brand-600 dark:text-brand-400" />
            <h3 className="text-sm font-semibold text-panel-ink dark:text-panel-ink-dark">
              {t('pages.system.sections.memory')}
            </h3>
            <span className="ml-auto text-sm font-medium tabular-nums">{info.memoryUsagePercent}%</span>
          </div>
          <ProgressBar percent={info.memoryUsagePercent} color="#3b82f6" />
          <div className="mt-4 grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs text-panel-muted dark:text-panel-muted-dark">{t('pages.system.labels.total')}</p>
              <p className="text-sm font-medium tabular-nums">{formatBytes(info.totalMemory)}</p>
            </div>
            <div>
              <p className="text-xs text-panel-muted dark:text-panel-muted-dark">{t('pages.system.labels.used')}</p>
              <p className="text-sm font-medium tabular-nums text-amber-600 dark:text-amber-400">
                {formatBytes(info.usedMemory)}
              </p>
            </div>
            <div>
              <p className="text-xs text-panel-muted dark:text-panel-muted-dark">{t('pages.system.labels.free')}</p>
              <p className="text-sm font-medium tabular-nums text-emerald-600 dark:text-emerald-400">
                {formatBytes(info.freeMemory)}
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="mb-4 flex items-center gap-2">
            <HardDrive className="h-4 w-4 text-violet-500 dark:text-violet-400" />
            <h3 className="text-sm font-semibold text-panel-ink dark:text-panel-ink-dark">
              {t('pages.system.sections.disk')}
            </h3>
            <span className="ml-auto text-sm font-medium tabular-nums">{info.disk.usagePercent}%</span>
          </div>
          <ProgressBar percent={info.disk.usagePercent} color="#8b5cf6" />
          <div className="mt-4 grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs text-panel-muted dark:text-panel-muted-dark">{t('pages.system.labels.total')}</p>
              <p className="text-sm font-medium tabular-nums">{formatBytes(info.disk.total)}</p>
            </div>
            <div>
              <p className="text-xs text-panel-muted dark:text-panel-muted-dark">{t('pages.system.labels.used')}</p>
              <p className="text-sm font-medium tabular-nums text-amber-600 dark:text-amber-400">
                {formatBytes(info.disk.used)}
              </p>
            </div>
            <div>
              <p className="text-xs text-panel-muted dark:text-panel-muted-dark">{t('pages.system.labels.free')}</p>
              <p className="text-sm font-medium tabular-nums text-emerald-600 dark:text-emerald-400">
                {formatBytes(info.disk.free)}
              </p>
            </div>
          </div>
          <p className="mt-3 text-xs text-panel-muted dark:text-panel-muted-dark">
            {t('pages.system.labels.mount')}: {info.disk.mount}
          </p>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card">
          <div className="mb-4 flex items-center gap-2">
            <Layers className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <h3 className="text-sm font-semibold text-panel-ink dark:text-panel-ink-dark">
              {t('pages.system.sections.components')}
            </h3>
          </div>
          <div className="space-y-3">
            <DetailRow
              label={t('pages.system.application.productName')}
              value={<Badge variant="default">v{crmVersion}</Badge>}
            />
            <DetailRow
              label={t('pages.system.components.dynamicApi')}
              value={<Badge variant="default">v{dynamicApiVersion}</Badge>}
            />
            <DetailRow
              label={t('pages.system.components.pyorchestrator')}
              value={
                pyorchVersion
                  ? <Badge variant="default">v{pyorchVersion}</Badge>
                  : <span className="text-panel-muted dark:text-panel-muted-dark">{t('pages.system.application.notInstalled')}</span>
              }
            />
          </div>
        </div>

        <div className="card">
          <div className="mb-4 flex items-center gap-2">
            <Cpu className="h-4 w-4 text-amber-500 dark:text-amber-400" />
            <h3 className="text-sm font-semibold text-panel-ink dark:text-panel-ink-dark">
              {t('pages.system.sections.cpuDetails')}
            </h3>
          </div>
          <div className="space-y-3">
            <DetailRowMultiline label={t('pages.system.cpu.model')} value={cpuModelLabel} />
            <DetailRow label={t('pages.system.cpu.cores')} value={info.cpuCores} />
            <DetailRow
              label={t('pages.system.cpu.speed')}
              value={formatCpuSpeed(info.cpuSpeed, t('common.notAvailable'))}
            />
            <DetailRow
              label={t('pages.system.cpu.loadAverage')}
              value={info.loadAverage.map((l) => l.toFixed(2)).join(' / ')}
            />
          </div>
        </div>

        <div className="card">
          <div className="mb-4 flex items-center gap-2">
            <Server className="h-4 w-4 text-brand-600 dark:text-brand-400" />
            <h3 className="text-sm font-semibold text-panel-ink dark:text-panel-ink-dark">
              {t('pages.system.sections.application')}
            </h3>
          </div>
          <div className="space-y-3">
            <DetailRow label={t('pages.system.application.name')} value={t('pages.system.application.productName')} />
            <DetailRow
              label={t('pages.system.application.version')}
              value={<Badge variant="default">v{crmVersion}</Badge>}
            />
            <DetailRow
              label={t('pages.system.application.environment')}
              value={<Badge variant="warning">{info.environment}</Badge>}
            />
            <DetailRow label={t('pages.system.application.platform')} value={platformLabel(info)} />
            <DetailRow label={t('pages.system.application.apiRuntime')} value={info.nodeVersion} />
          </div>
        </div>
      </div>

      {info.network.interfaces.length > 0 && (
        <div className="card">
          <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2">
              <Network className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
              <h3 className="text-sm font-semibold text-panel-ink dark:text-panel-ink-dark">
                {t('pages.system.sections.network')}
              </h3>
            </div>
            <input
              className={clsx('input sm:max-w-xs')}
              value={networkSearch}
              onChange={(e) => setNetworkSearch(e.target.value)}
              placeholder={t('pages.system.network.searchPlaceholder')}
            />
          </div>
          {filteredInterfaces.length === 0 ? (
            <p className="py-6 text-center text-sm text-panel-muted dark:text-panel-muted-dark">
              {t('pages.system.network.empty')}
            </p>
          ) : (
            <Table>
              <thead>
                <tr className="border-b border-panel-border dark:border-panel-border-dark">
                  <th className="px-4 py-3 font-medium text-panel-muted dark:text-panel-muted-dark">
                    {t('pages.system.network.interface')}
                  </th>
                  <th className="px-4 py-3 font-medium text-panel-muted dark:text-panel-muted-dark">
                    {t('pages.system.network.address')}
                  </th>
                  <th className="px-4 py-3 font-medium text-panel-muted dark:text-panel-muted-dark">
                    {t('pages.system.network.family')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredInterfaces.map((iface, i) => (
                  <tr
                    key={`${iface.name}-${iface.address}-${i}`}
                    className="border-b border-panel-border/60 last:border-0 dark:border-panel-border-dark/60"
                  >
                    <td className="px-4 py-3 font-medium">{iface.name}</td>
                    <td className="px-4 py-3 font-mono text-xs">{iface.address}</td>
                    <td className="px-4 py-3">
                      <Badge variant="default">{iface.family}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>
      )}
    </div>
  );
}
