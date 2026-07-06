import { Link } from 'react-router-dom';
import { ArrowUpCircle, Loader2, X } from 'lucide-react';
import { useState } from 'react';
import clsx from 'clsx';
import { applyUpdate, dismissUpdate } from '../api/updates';
import { useSoftwareUpdatesContext } from '../context/SoftwareUpdatesContext';
import { useAuth } from '../context/AuthContext';

function stepBarClass(status: string): string {
  if (status === 'completed') return 'bg-brand-500';
  if (status === 'running') return 'bg-brand-400 animate-pulse';
  if (status === 'failed') return 'bg-red-500';
  return 'bg-brand-200 dark:bg-brand-900';
}

export function UpdateBanner() {
  const { isAdmin } = useAuth();
  const ctx = useSoftwareUpdatesContext();
  const [applying, setApplying] = useState(false);

  if (!isAdmin || !ctx?.status) return null;

  const { status, refresh } = ctx;

  if (status.activeJob) {
    const job = status.activeJob;
    const runningStep =
      job.steps.find((s) => s.status === 'running') ??
      job.steps.find((s) => s.status === 'pending');
    return (
      <div className="border-b border-brand-500/20 bg-brand-500/5 px-3 py-3 dark:border-brand-400/20 dark:bg-brand-400/10 sm:px-4 lg:px-6">
        <div className="mx-auto flex max-w-[1600px] items-start gap-3">
          <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-brand-600 dark:text-brand-400" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-brand-900 dark:text-brand-100">
              Обновление {job.component}: v{job.fromVersion} → v{job.targetVersion}
            </div>
            <div className="mt-0.5 text-xs text-brand-800/90 dark:text-brand-200/80">
              {runningStep ? runningStep.label : 'Подготовка…'}
              {runningStep?.message ? ` — ${runningStep.message}` : ''}
            </div>
            <div className="mt-2 flex gap-1">
              {job.steps.map((step) => (
                <div
                  key={step.id}
                  className={clsx('h-1.5 flex-1 rounded-full', stepBarClass(step.status))}
                  title={step.label}
                />
              ))}
            </div>
          </div>
          <Link to="/settings#updates" className="shrink-0 text-xs font-medium text-brand-700 hover:underline dark:text-brand-300">
            Подробнее
          </Link>
        </div>
      </div>
    );
  }

  const pending = status.components.filter((c) => c.updateAvailable && c.latestVersion);
  if (!status.showNotification || pending.length === 0) return null;

  const primary = pending[0]!;

  const onDismiss = async () => {
    if (!primary.latestVersion) return;
    await dismissUpdate(primary.id, primary.latestVersion);
    await refresh();
  };

  const onApply = async () => {
    if (!status.executorAvailable) {
      alert(status.executorReason || 'Автообновление недоступно');
      return;
    }
    if (!confirm(`Обновить ${primary.label} до v${primary.latestVersion}? Сервисы перезапустятся.`)) return;
    setApplying(true);
    try {
      await applyUpdate(primary.id, primary.latestTag || undefined);
      await refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Ошибка обновления');
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="border-b border-amber-200 bg-amber-50 px-3 py-3 dark:border-amber-800/60 dark:bg-amber-950/30 sm:px-4 lg:px-6">
      <div className="mx-auto flex max-w-[1600px] items-start gap-3">
        <ArrowUpCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-amber-950 dark:text-amber-100">
            Доступно обновление: {primary.label} v{primary.latestVersion}
            {pending.length > 1 && ` (+${pending.length - 1} компонентов)`}
          </div>
          <div className="mt-0.5 text-xs text-amber-900/80 dark:text-amber-200/80">
            Установлено v{primary.currentVersion}. Обновления загружаются с GitHub.
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {status.executorAvailable && (
            <button type="button" className="btn-primary btn-sm" disabled={applying} onClick={() => void onApply()}>
              {applying ? 'Запуск…' : 'Обновить'}
            </button>
          )}
          <Link to="/settings#updates" className="btn-secondary btn-sm">
            Все обновления
          </Link>
          <button type="button" className="btn-icon !h-8 !w-8" title="Скрыть" onClick={() => void onDismiss()}>
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
