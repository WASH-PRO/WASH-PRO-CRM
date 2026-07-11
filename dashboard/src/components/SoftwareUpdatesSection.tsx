import { useState } from 'react';
import { ArrowUpCircle, ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import clsx from 'clsx';
import {
  applyUpdate,
  dismissUpdate,
  type ComponentCheck,
  type UpdateComponentId,
  type UpdateJob,
} from '../api/updates';
import { useSoftwareUpdatesContext } from '../context/SoftwareUpdatesContext';
import { useLocale } from '../i18n/LocaleContext';

function VersionRow({
  current,
  latest,
  updateAvailable,
  availableLabel,
}: {
  current: string;
  latest: string | null;
  updateAvailable: boolean;
  availableLabel: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="font-mono text-panel-ink dark:text-panel-ink-dark">v{current}</span>
      {latest && (
        <>
          <span className="text-panel-muted">→</span>
          <span className={clsx('font-mono font-medium', updateAvailable ? 'text-amber-700 dark:text-amber-300' : 'text-panel-muted')}>
            v{latest}
          </span>
        </>
      )}
      {updateAvailable && (
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
          {availableLabel}
        </span>
      )}
    </div>
  );
}

function JobProgress({
  job,
  title,
  failedLabel,
}: {
  job: UpdateJob;
  title: string;
  failedLabel?: string;
}) {
  return (
    <div className="mt-4 space-y-3 rounded-lg border border-brand-500/20 bg-brand-500/5 p-3 dark:border-brand-400/20 dark:bg-brand-400/10">
      <div className="flex items-center gap-2 text-sm font-medium text-brand-900 dark:text-brand-100">
        {job.status === 'running' || job.status === 'queued' ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : null}
        {title}
      </div>
      {job.status === 'failed' && (job.error || failedLabel) && (
        <p className="text-xs font-medium text-red-600 dark:text-red-400">{job.error || failedLabel}</p>
      )}
      <div className="space-y-2">
        {job.steps.map((step) => (
          <div key={step.id} className="flex items-center gap-2 text-xs">
            <span
              className={clsx(
                'h-2 w-2 rounded-full',
                step.status === 'completed' && 'bg-emerald-500',
                step.status === 'running' && 'bg-brand-500 animate-pulse',
                step.status === 'failed' && 'bg-red-500',
                step.status === 'pending' && 'bg-slate-300 dark:bg-slate-600'
              )}
            />
            <span className="flex-1 text-panel-ink dark:text-panel-ink-dark">{step.label}</span>
            <span className="text-panel-muted">{step.message || step.status}</span>
          </div>
        ))}
      </div>
      {job.logs.length > 0 && (
        <pre className="max-h-40 overflow-auto rounded border border-panel-border bg-panel-canvas p-2 font-mono text-[10px] leading-relaxed dark:border-panel-border-dark dark:bg-[#0d1218]">
          {job.logs.slice(-40).join('\n')}
        </pre>
      )}
    </div>
  );
}

function latestComponentJob(
  activeJob: UpdateJob | null,
  recentJobs: UpdateJob[],
  componentId: UpdateComponentId
): UpdateJob | null {
  if (activeJob?.component === componentId) return activeJob;
  const latest = recentJobs.find((j) => j.component === componentId);
  if (!latest || latest.status === 'completed') return null;
  return latest;
}

function ComponentCard({
  component,
  activeJob,
  recentJobs,
  executorAvailable,
  executorReason,
  onChanged,
  t,
}: {
  component: ComponentCheck;
  activeJob: UpdateJob | null;
  recentJobs: UpdateJob[];
  executorAvailable: boolean;
  executorReason: string | null;
  onChanged: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const [busy, setBusy] = useState(false);
  const componentJob = latestComponentJob(activeJob, recentJobs, component.id);
  const isActive = componentJob?.status === 'running' || componentJob?.status === 'queued';
  const isFailed = componentJob?.status === 'failed';

  const runUpdate = async () => {
    if (!executorAvailable) {
      alert(executorReason || t('updates.autoUnavailable'));
      return;
    }
    if (!component.latestVersion) return;
    if (!confirm(t('updates.confirmUpdate', { component: component.label, version: component.latestVersion }))) return;
    setBusy(true);
    try {
      await applyUpdate(component.id, component.latestTag || undefined);
      await onChanged();
    } catch (err) {
      alert(err instanceof Error ? err.message : t('updates.error'));
    } finally {
      setBusy(false);
    }
  };

  const runDismiss = async () => {
    if (!component.latestVersion) return;
    await dismissUpdate(component.id, component.latestVersion);
    await onChanged();
  };

  const githubHref = component.releaseUrl ?? `https://github.com/${component.githubRepo}`;

  return (
    <div className="rounded-panel border border-panel-border bg-panel-card p-4 shadow-panel dark:border-panel-border-dark dark:bg-panel-card-dark">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="font-semibold text-panel-ink dark:text-panel-ink-dark">{component.label}</h4>
          <p className="mt-1 font-mono text-[11px] text-panel-muted">{component.githubRepo}</p>
        </div>
        <a href={githubHref} target="_blank" rel="noopener noreferrer" className="btn-secondary btn-sm">
          GitHub <ExternalLink size={12} />
        </a>
      </div>

      <div className="mt-3">
        <VersionRow
          current={component.currentVersion}
          latest={component.latestVersion}
          updateAvailable={component.updateAvailable}
          availableLabel={t('updates.available')}
        />
      </div>

      {component.releaseNotes && component.updateAvailable && (
        <p className="field-hint mt-2 line-clamp-3 whitespace-pre-wrap">{component.releaseNotes.slice(0, 280)}</p>
      )}

      {componentJob && (isActive || isFailed) && (
        <JobProgress
          job={componentJob}
          title={
            isFailed
              ? t('updates.jobFailed', { from: componentJob.fromVersion, to: componentJob.targetVersion })
              : t('updates.jobTitle', { from: componentJob.fromVersion, to: componentJob.targetVersion })
          }
          failedLabel={isFailed ? t('updates.jobFailedHint') : undefined}
        />
      )}

      {component.updateAvailable && !isActive && !isFailed && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="btn-primary btn-sm" disabled={busy || !executorAvailable} onClick={() => void runUpdate()}>
            <ArrowUpCircle size={14} /> {busy ? t('updates.starting') : t('updates.update')}
          </button>
          <button type="button" className="btn-secondary btn-sm" onClick={() => void runDismiss()}>
            {t('updates.hideNotification')}
          </button>
        </div>
      )}
    </div>
  );
}

export function SoftwareUpdatesSection() {
  const { t, locale } = useLocale();
  const ctx = useSoftwareUpdatesContext();
  const [checking, setChecking] = useState(false);

  if (!ctx) {
    return (
      <p className="text-sm text-panel-muted">{t('updates.loadingStatus')}</p>
    );
  }

  const { status, loading, refresh, checkGithub } = ctx;

  const handleCheck = async () => {
    setChecking(true);
    try {
      await checkGithub();
    } catch (err) {
      alert(err instanceof Error ? err.message : t('updates.checkFailed'));
    } finally {
      setChecking(false);
    }
  };

  if (loading && !status) {
    return <p className="text-sm text-panel-muted">{t('updates.checkingGithub')}</p>;
  }

  if (!status) return null;

  return (
    <div id="updates" className="space-y-4 scroll-mt-24">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-panel-muted dark:text-panel-muted-dark">
            {t('updates.description')}
          </p>
          {status.lastCheckAt && (
            <p className="field-hint mt-1">
              {t('updates.lastChecked')}: {new Date(status.lastCheckAt).toLocaleString(locale === 'ru' ? 'ru-RU' : 'en-US')}
            </p>
          )}
        </div>
        <button type="button" className="btn-secondary btn-sm" disabled={checking} onClick={() => void handleCheck()}>
          <RefreshCw size={14} className={checking ? 'animate-spin' : ''} />
          {checking ? t('updates.checking') : t('updates.checkNow')}
        </button>
      </div>

      {!status.executorAvailable && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
          {status.executorReason || t('updates.autoUnavailableViewOnly')}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {status.components.map((component) => (
          <ComponentCard
            key={component.id}
            component={component}
            activeJob={status.activeJob}
            recentJobs={status.recentJobs}
            executorAvailable={status.executorAvailable}
            executorReason={status.executorReason}
            onChanged={refresh}
            t={t}
          />
        ))}
      </div>

      {status.recentJobs.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-semibold">{t('updates.historyTitle')}</h4>
          <div className="space-y-2">
            {status.recentJobs.slice(0, 5).map((job) => (
              <div
                key={job.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-panel-border px-3 py-2 text-sm dark:border-panel-border-dark"
              >
                <span>
                  {job.component}: v{job.fromVersion} → v{job.targetVersion}
                </span>
                <span
                  className={clsx(
                    'text-xs font-medium',
                    job.status === 'completed' && 'text-emerald-600',
                    job.status === 'failed' && 'text-red-600',
                    job.status === 'running' && 'text-brand-600'
                  )}
                >
                  {job.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function componentVersionLabel(
  status: { components: ComponentCheck[] } | null | undefined,
  id: UpdateComponentId
): string | null {
  const c = status?.components.find((x) => x.id === id);
  if (!c) return null;
  if (c.updateAvailable && c.latestVersion) return `v${c.currentVersion} → v${c.latestVersion}`;
  return `v${c.currentVersion}`;
}
