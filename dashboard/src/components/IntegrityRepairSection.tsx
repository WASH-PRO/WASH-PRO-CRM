import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, ShieldCheck, Wrench } from 'lucide-react';
import {
  applyIntegrityRepair,
  diagnoseIntegrity,
  type RepairDiagnoseResult,
  type RepairIssue,
} from '../api/updates';
import { useLocale } from '../i18n/LocaleContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';

const FIX_LABEL_KEYS: Record<string, string> = {
  sync_host_root_env: 'pages.settings.repair.fixes.syncHostRoot',
  normalize_data_dir: 'pages.settings.repair.fixes.normalizeDataDir',
  git_safe_directory: 'pages.settings.repair.fixes.gitSafeDirectory',
  clear_stuck_job: 'pages.settings.repair.fixes.clearStuckJob',
  mosquitto_repair: 'pages.settings.repair.fixes.mosquittoRepair',
  modules_bridge_repair: 'pages.settings.repair.fixes.modulesBridgeRepair',
  pyorch_runtime_repair: 'pages.settings.repair.fixes.pyorchRuntimeRepair',
  wash_modules_recover: 'pages.settings.repair.fixes.washModulesRecover',
  init_seed: 'pages.settings.repair.fixes.initSeed',
};

function issueLabel(t: (key: string, params?: Record<string, string | number>) => string, issue: RepairIssue): string {
  const key = `pages.settings.repair.issues.${issue.code}`;
  const text = t(key, issue.detail ? { detail: issue.detail } : undefined);
  return text === key ? `${issue.code}${issue.detail ? `: ${issue.detail}` : ''}` : text;
}

function SeverityIcon({ severity }: { severity: RepairIssue['severity'] }) {
  if (severity === 'ok') return <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />;
  if (severity === 'warning') return <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />;
  return <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />;
}

export function IntegrityRepairSection({ canManage }: { canManage: boolean }) {
  const { t, locale } = useLocale();
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const [busy, setBusy] = useState(false);
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState<RepairDiagnoseResult | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [selectedFixes, setSelectedFixes] = useState<Set<string>>(new Set());

  const fixableIssues = useMemo(
    () => (result?.issues ?? []).filter((issue) => issue.fixId && issue.severity !== 'ok'),
    [result]
  );

  const uniqueFixIds = useMemo(() => {
    const ids = new Set<string>();
    for (const issue of fixableIssues) {
      if (issue.fixId) ids.add(issue.fixId);
    }
    return [...ids];
  }, [fixableIssues]);

  const runDiagnose = async () => {
    setBusy(true);
    setLogs([]);
    try {
      const data = await diagnoseIntegrity();
      setResult(data);
      const defaults = new Set<string>();
      for (const issue of data.issues) {
        if (issue.fixId && issue.severity !== 'ok') defaults.add(issue.fixId);
      }
      setSelectedFixes(defaults);
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('pages.settings.repair.error'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const toggleFix = (fixId: string) => {
    setSelectedFixes((prev) => {
      const next = new Set(prev);
      if (next.has(fixId)) next.delete(fixId);
      else next.add(fixId);
      return next;
    });
  };

  const runApply = async () => {
    if (selectedFixes.size === 0) return;
    if (!(await confirm({ message: t('pages.settings.repair.confirmApply'), variant: 'danger' }))) return;
    setApplying(true);
    try {
      const data = await applyIntegrityRepair([...selectedFixes]);
      setResult(data.diagnose);
      setLogs(data.logs);
      if (data.failed.length > 0) {
        showToast(data.failed.map((f) => `${f.action}: ${f.error}`).join('\n'), 'error');
      }
      const defaults = new Set<string>();
      for (const issue of data.diagnose.issues) {
        if (issue.fixId && issue.severity !== 'ok') defaults.add(issue.fixId);
      }
      setSelectedFixes(defaults);
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('pages.settings.repair.error'), 'error');
    } finally {
      setApplying(false);
    }
  };

  return (
    <div id="integrity-repair" className="space-y-4 scroll-mt-24">
      <p className="text-sm text-panel-muted dark:text-panel-muted-dark">{t('pages.settings.repair.description')}</p>

      {!canManage && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
          {t('pages.settings.repair.adminOnly')}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-secondary btn-sm"
          disabled={busy || !canManage}
          onClick={() => void runDiagnose()}
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
          {busy ? t('pages.settings.repair.checking') : t('pages.settings.repair.check')}
        </button>

        {result && uniqueFixIds.length > 0 && (
          <button
            type="button"
            className="btn-primary btn-sm"
            disabled={applying || !canManage || selectedFixes.size === 0}
            onClick={() => void runApply()}
          >
            {applying ? <Loader2 size={14} className="animate-spin" /> : <Wrench size={14} />}
            {applying ? t('pages.settings.repair.applying') : t('pages.settings.repair.apply')}
          </button>
        )}
      </div>

      {result && (
        <div className="space-y-4">
          <div className="rounded-lg border border-panel-border bg-panel-canvas p-3 text-xs dark:border-panel-border-dark dark:bg-[#0d1218]">
            <p className="mb-2 font-semibold text-panel-ink dark:text-panel-ink-dark">{t('pages.settings.repair.pathsTitle')}</p>
            <dl className="grid gap-1 sm:grid-cols-2">
              <div>
                <dt className="text-panel-muted">{t('pages.settings.repair.deployRoot')}</dt>
                <dd className="font-mono break-all">{result.paths.deployRoot}</dd>
              </div>
              <div>
                <dt className="text-panel-muted">{t('pages.settings.repair.hostRoot')}</dt>
                <dd className="font-mono break-all">{result.paths.hostProjectRoot}</dd>
              </div>
              <div>
                <dt className="text-panel-muted">{t('pages.settings.repair.detectedRoot')}</dt>
                <dd className="font-mono break-all">{result.paths.detectedHostRoot ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-panel-muted">{t('pages.settings.repair.dataDir')}</dt>
                <dd className="font-mono break-all">{result.paths.hostDataDir}</dd>
              </div>
              <div>
                <dt className="text-panel-muted">WASH_HOST_PROJECT_ROOT (.env)</dt>
                <dd className="font-mono break-all">{result.paths.envWashHostRoot ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-panel-muted">DATA_DIR (.env)</dt>
                <dd className="font-mono break-all">{result.paths.envDataDir ?? '—'}</dd>
              </div>
            </dl>
            <p className="field-hint mt-2">
              {t('pages.settings.repair.checkedAt')}:{' '}
              {new Date(result.checkedAt).toLocaleString(locale === 'ru' ? 'ru-RU' : 'en-US')}
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-panel-ink dark:text-panel-ink-dark">
              {result.healthy ? t('pages.settings.repair.healthy') : t('pages.settings.repair.issuesTitle')}
            </h4>
            {result.issues.map((issue, idx) => (
              <div
                key={`${issue.code}-${idx}`}
                className={clsx(
                  'flex items-start gap-2 rounded-lg border px-3 py-2 text-sm',
                  issue.severity === 'ok' && 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/20',
                  issue.severity === 'warning' && 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/20',
                  issue.severity === 'error' && 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/20'
                )}
              >
                <SeverityIcon severity={issue.severity} />
                <span className="flex-1 text-panel-ink dark:text-panel-ink-dark">{issueLabel(t, issue)}</span>
              </div>
            ))}
          </div>

          {uniqueFixIds.length > 0 && (
            <div className="rounded-lg border border-panel-border p-3 dark:border-panel-border-dark">
              <p className="mb-2 text-sm font-semibold">{t('pages.settings.repair.fixesTitle')}</p>
              <div className="space-y-2">
                {uniqueFixIds.map((fixId) => (
                  <label key={fixId} className="flex cursor-pointer items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={selectedFixes.has(fixId)}
                      disabled={!canManage || applying}
                      onChange={() => toggleFix(fixId)}
                    />
                    <span>{t(FIX_LABEL_KEYS[fixId] ?? fixId)}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {logs.length > 0 && (
        <pre className="max-h-48 overflow-auto rounded border border-panel-border bg-panel-canvas p-2 font-mono text-[10px] leading-relaxed dark:border-panel-border-dark dark:bg-[#0d1218]">
          {logs.join('\n')}
        </pre>
      )}

      <button
        type="button"
        className="btn-ghost btn-sm text-panel-muted"
        disabled={busy || !canManage}
        onClick={() => void runDiagnose()}
      >
        <RefreshCw size={12} className={busy ? 'animate-spin' : ''} />
        {t('pages.settings.repair.recheck')}
      </button>
    </div>
  );
}
