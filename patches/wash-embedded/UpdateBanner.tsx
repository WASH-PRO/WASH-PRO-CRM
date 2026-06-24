import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpCircle, X, Loader2 } from 'lucide-react';
import { api } from '../services/api';
import { UpdateStatus } from '../types';
import { userHasPermission } from '../utils/permissions';
import { useAuth } from '../context/AuthContext';

export default function UpdateBanner() {
  if (import.meta.env.VITE_WASH_EMBEDDED === 'true') return null;

  const { user } = useAuth();
  const canManage = userHasPermission(user, 'manage_users') && userHasPermission(user, 'manage_api');
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [applying, setApplying] = useState(false);

  const load = () => {
    if (!canManage) return;
    api.getUpdateStatus().then(setStatus).catch(() => {});
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, status?.activeJob ? 3000 : 60000);
    return () => clearInterval(timer);
  }, [canManage, status?.activeJob?.status]);

  const apply = async () => {
    if (!status?.executorAvailable) {
      alert(status?.executorReason ?? 'Auto-update is not available');
      return;
    }
    setApplying(true);
    try {
      let next = status;
      if (!next.updateAvailable || !next.latestVersion) {
        await api.checkForUpdates();
        next = await api.getUpdateStatus();
        setStatus(next);
      }
      if (!next.latestVersion) {
        alert('No release found on GitHub');
        return;
      }
      if (!next.updateAvailable) {
        alert(`Already on latest version (v${next.currentVersion})`);
        return;
      }
      if (!confirm(`Update to v${next.latestVersion}? Services will restart briefly.`)) return;
      await api.applyUpdate(next.latestVersion);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setApplying(false);
    }
  };

  if (!canManage || !status) return null;

  if (status.activeJob) {
    const job = status.activeJob;
    const runningStep =
      job.steps.find((s) => s.status === 'running') ??
      (job.status === 'queued' ? null : job.steps.find((s) => s.status === 'pending'));
    const isQueued = job.status === 'queued';
    return (
      <div className="mb-4 rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 dark:border-brand-800 dark:bg-brand-950/40">
        <div className="flex items-start gap-3">
          <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-brand-600 dark:text-brand-300" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-brand-900 dark:text-brand-100">
              {isQueued ? 'Preparing update' : `Updating to v${job.targetVersion}`}
              {job.status === 'rolling_back' && ' — rolling back'}
            </div>
            <div className="mt-0.5 text-xs text-brand-800/80 dark:text-brand-200/80">
              {isQueued
                ? `Target v${job.targetVersion} — waiting for updater`
                : runningStep
                  ? `${runningStep.label}${runningStep.message ? ` — ${runningStep.message}` : ''}`
                  : 'Processing…'}
            </div>
            <div className="mt-2 flex gap-1">
              {job.steps.map((step) => (
                <div
                  key={step.id}
                  className={[
                    'h-1.5 flex-1 rounded-full',
                    step.status === 'completed' ? 'bg-brand-500' :
                    step.status === 'running' ? 'bg-brand-400 animate-pulse' :
                    step.status === 'failed' ? 'bg-red-500' : 'bg-brand-200 dark:bg-brand-900',
                  ].join(' ')}
                  title={step.label}
                />
              ))}
            </div>
          </div>
          <Link to="/settings" className="text-xs font-medium text-brand-700 hover:underline dark:text-brand-300">
            Details
          </Link>
        </div>
      </div>
    );
  }

  const showBanner = status.showNotification || (status.updateAvailable && !!status.latestVersion);

  if (!showBanner || !status.latestVersion) return null;

  const dismiss = async () => {
    await api.dismissUpdate(status.latestVersion!);
    load();
  };

  return (
    <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950/30">
      <div className="flex items-start gap-3">
        <ArrowUpCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-amber-950 dark:text-amber-100">
            Update available: v{status.latestVersion}
          </div>
          <div className="mt-0.5 text-xs text-amber-900/80 dark:text-amber-200/80">
            Current version v{status.currentVersion}.
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {status.executorAvailable && (
              <button className="btn-primary !py-1 !px-3 text-xs" onClick={apply} disabled={applying}>
                {applying ? 'Starting…' : 'Update now'}
              </button>
            )}
            <Link to="/settings" className="btn-secondary !py-1 !px-3 text-xs">
              Settings
            </Link>
            {status.releaseUrl && (
              <a
                href={status.releaseUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary !py-1 !px-3 text-xs"
              >
                Release notes
              </a>
            )}
          </div>
        </div>
        <button type="button" onClick={dismiss} className="text-amber-700 hover:text-amber-900 dark:text-amber-300" title="Dismiss">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
