import { useEffect, useState } from 'react';
import { Save, Trash2, Shield, Gauge, FileText, Globe, RefreshCw, Download, Upload, ArrowUpCircle } from 'lucide-react';
import { api } from '../services/api';
import { AppSettings, UpdateSettings, UpdateStatus } from '../types';
import { PageHeader, LoadingSpinner } from '../components/UI';
import WashSoftwareUpdatesSection from '../components/WashSoftwareUpdatesSection';

const washEmbedded = import.meta.env.VITE_WASH_EMBEDDED === 'true';

function msToMinutes(ms: number): number {
  return Math.round(ms / 60000);
}

function minutesToMs(min: number): number {
  return min * 60000;
}

function SettingSection({ title, icon: Icon, children }: { title: string; icon: typeof Shield; children: React.ReactNode }) {
  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-dark-border">
        <Icon className="h-4 w-4 text-brand-600 dark:text-brand-300" />
        <h3 className="font-semibold text-sm">{title}</h3>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      {children}
      {hint && <p className="text-xs text-dark-muted mt-1">{hint}</p>}
    </div>
  );
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [logsCount, setLogsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [includeData, setIncludeData] = useState(false);
  const [includeSettings, setIncludeSettings] = useState(false);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [updateSettings, setUpdateSettings] = useState<UpdateSettings | null>(null);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null);
  const [updateSaving, setUpdateSaving] = useState(false);
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [applyingUpdate, setApplyingUpdate] = useState(false);
  const [cancellingUpdate, setCancellingUpdate] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.getSettings(),
      api.getUpdateSettings().catch(() => null),
      api.getUpdateStatus().catch(() => null),
    ])
      .then(([data, updSettings, updStatus]) => {
        setSettings(data.settings);
        setLogsCount(data.logsCount);
        if (updSettings) setUpdateSettings(updSettings);
        if (updStatus) setUpdateStatus(updStatus);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!updateStatus?.activeJob) return;
    const timer = setInterval(() => {
      api.getUpdateStatus().then(setUpdateStatus).catch(() => {});
    }, 3000);
    return () => clearInterval(timer);
  }, [updateStatus?.activeJob?._id, updateStatus?.activeJob?.status]);

  const saveUpdateSettings = async () => {
    if (!updateSettings) return;
    setUpdateSaving(true);
    try {
      const updated = await api.updateUpdateSettings(updateSettings);
      setUpdateSettings(updated);
      alert('Update settings saved');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setUpdateSaving(false);
    }
  };

  const checkUpdatesNow = async () => {
    setCheckingUpdates(true);
    try {
      await api.checkForUpdates();
      const status = await api.getUpdateStatus();
      setUpdateStatus(status);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Check failed');
    } finally {
      setCheckingUpdates(false);
    }
  };

  const applyUpdateNow = async () => {
    if (!updateStatus?.executorAvailable) {
      alert(updateStatus?.executorReason ?? 'Auto-update is not available on this server');
      return;
    }
    if (updateStatus.activeJob) return;

    setApplyingUpdate(true);
    try {
      let status = updateStatus;
      if (!status.updateAvailable || !status.latestVersion) {
        await api.checkForUpdates();
        status = await api.getUpdateStatus();
        setUpdateStatus(status);
      }
      if (!status.latestVersion) {
        alert('No release found on GitHub. Check repository settings.');
        return;
      }
      if (!status.updateAvailable) {
        alert(`You are already on the latest version (v${status.currentVersion}).`);
        return;
      }
      if (!confirm(`Update to v${status.latestVersion}? Services will restart briefly.`)) return;
      await api.applyUpdate(status.latestVersion);
      const next = await api.getUpdateStatus();
      setUpdateStatus(next);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setApplyingUpdate(false);
    }
  };

  const cancelUpdate = async () => {
    if (!updateStatus?.activeJob?._id) return;
    if (!confirm('Cancel this update?')) return;
    setCancellingUpdate(true);
    try {
      await api.cancelUpdate(updateStatus.activeJob._id);
      const status = await api.getUpdateStatus();
      setUpdateStatus(status);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Cancel failed');
    } finally {
      setCancellingUpdate(false);
    }
  };

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const updated = await api.updateSettings(settings);
      setSettings(updated);
      alert('Settings saved successfully');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const clearAllLogs = async () => {
    if (!confirm('Delete ALL audit logs? This cannot be undone.')) return;
    setClearing(true);
    try {
      const res = await api.clearAllLogs();
      setLogsCount(0);
      alert(res.message);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed');
    } finally {
      setClearing(false);
    }
  };

  const clearOldLogs = async () => {
    if (!confirm(`Delete logs older than ${settings?.logRetentionDays} days?`)) return;
    setClearing(true);
    try {
      const res = await api.clearOldLogs();
      load();
      alert(res.message);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed');
    } finally {
      setClearing(false);
    }
  };

  const exportProject = async () => {
    setExporting(true);
    try {
      const bundle = await api.exportProject({ includeData, includeSettings });
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `dynamic-api-project-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const importProject = async (file: File) => {
    if (importMode === 'replace' && !confirm('Replace mode will delete all custom endpoints and groups. Continue?')) return;
    setImporting(true);
    try {
      const text = await file.text();
      const bundle = JSON.parse(text);
      const res = await api.importProject(bundle, { mode: importMode, includeData });
      alert(res.message);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  if (loading || !settings) return <LoadingSpinner />;

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Platform configuration, security and maintenance"
        action={
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={load}>
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
            <button className="btn-primary" onClick={save} disabled={saving}>
              <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SettingSection title="Security & Authentication" icon={Shield}>
          <Field label="Max login attempts" hint="Failed attempts before IP lockout">
            <input type="number" className="input" min={1} max={100}
              value={settings.authMaxAttempts}
              onChange={(e) => setSettings({ ...settings, authMaxAttempts: parseInt(e.target.value) || 5 })} />
          </Field>
          <Field label="Lockout duration (minutes)" hint="How long IP is blocked after max attempts">
            <input type="number" className="input" min={1} max={1440}
              value={msToMinutes(settings.authLockoutDurationMs)}
              onChange={(e) => setSettings({ ...settings, authLockoutDurationMs: minutesToMs(parseInt(e.target.value) || 15) })} />
          </Field>
          <Field label="JWT access token lifetime" hint="e.g. 15m, 1h, 7d">
            <input className="input font-mono" value={settings.jwtExpiresIn}
              onChange={(e) => setSettings({ ...settings, jwtExpiresIn: e.target.value })} />
          </Field>
          <Field label="JWT refresh token lifetime">
            <input className="input font-mono" value={settings.jwtRefreshExpiresIn}
              onChange={(e) => setSettings({ ...settings, jwtRefreshExpiresIn: e.target.value })} />
          </Field>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={settings.enableRegistration}
              onChange={(e) => setSettings({ ...settings, enableRegistration: e.target.checked })} />
            Allow public user registration
          </label>
        </SettingSection>

        <SettingSection title="API Rate Limiting" icon={Gauge}>
          <Field label="Max requests per IP" hint="Maximum API calls per time window">
            <input type="number" className="input" min={10} max={100000}
              value={settings.rateLimitMax}
              onChange={(e) => setSettings({ ...settings, rateLimitMax: parseInt(e.target.value) || 1000 })} />
          </Field>
          <Field label="Rate limit window (minutes)" hint="Time window for request counting">
            <input type="number" className="input" min={1} max={60}
              value={msToMinutes(settings.rateLimitWindowMs)}
              onChange={(e) => setSettings({ ...settings, rateLimitWindowMs: minutesToMs(parseInt(e.target.value) || 15) })} />
          </Field>
          <div className="bg-dark-bg rounded-md p-3 text-xs text-dark-muted">
            Current: <span className="text-dark-text font-medium">{settings.rateLimitMax}</span> requests per{' '}
            <span className="text-dark-text font-medium">{msToMinutes(settings.rateLimitWindowMs)}</span> minutes per IP.
            Changes apply immediately after save.
          </div>
        </SettingSection>

        <SettingSection title="Logs & Audit" icon={FileText}>
          <div className="flex items-center justify-between bg-dark-bg rounded-md p-3">
            <span className="text-sm text-dark-muted">Total log records</span>
            <span className="text-lg font-bold text-brand-600 dark:text-brand-300">{logsCount.toLocaleString()}</span>
          </div>
          <Field label="Log retention (days)" hint="Logs older than this are removed when cleaning">
            <input type="number" className="input" min={1} max={365}
              value={settings.logRetentionDays}
              onChange={(e) => setSettings({ ...settings, logRetentionDays: parseInt(e.target.value) || 30 })} />
          </Field>
          <div className="flex gap-2 pt-2">
            <button className="btn-secondary flex-1 justify-center" onClick={clearOldLogs} disabled={clearing}>
              <Trash2 className="w-4 h-4" /> Clear old logs
            </button>
            <button className="btn-danger flex-1 justify-center" onClick={clearAllLogs} disabled={clearing}>
              <Trash2 className="w-4 h-4" /> Clear all logs
            </button>
          </div>
        </SettingSection>

        <SettingSection title="Project Export / Import" icon={Download}>
          <p className="text-xs text-dark-muted">
            Export endpoint groups, endpoints, and optionally runtime data and settings to a JSON file.
            Users and audit logs are never included.
          </p>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={includeData} onChange={(e) => setIncludeData(e.target.checked)} />
            Include endpoint runtime data
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={includeSettings} onChange={(e) => setIncludeSettings(e.target.checked)} />
            Include platform settings
          </label>
          <button className="btn-primary w-full justify-center" onClick={exportProject} disabled={exporting}>
            <Download className="w-4 h-4" /> {exporting ? 'Exporting...' : 'Download project.json'}
          </button>
          <Field label="Import mode">
            <select className="select" value={importMode} onChange={(e) => setImportMode(e.target.value as 'merge' | 'replace')}>
              <option value="merge">Merge — update existing by path+method</option>
              <option value="replace">Replace — delete all custom endpoints first</option>
            </select>
          </Field>
          <label className="btn-secondary w-full justify-center cursor-pointer">
            <Upload className="w-4 h-4" /> {importing ? 'Importing...' : 'Import project.json'}
            <input
              type="file"
              accept="application/json,.json"
              className="hidden"
              disabled={importing}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void importProject(file);
                e.target.value = '';
              }}
            />
          </label>
        </SettingSection>

        <SettingSection title="Software Updates" icon={ArrowUpCircle}>
          {washEmbedded ? (
            <WashSoftwareUpdatesSection updateStatus={updateStatus} />
          ) : (
          <>
          {updateStatus && (
            <div className="bg-dark-bg rounded-md p-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-dark-muted">Installed version</span>
                <span className="font-mono font-medium">v{updateStatus.currentVersion}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-dark-muted">Latest on GitHub</span>
                <span className="font-mono font-medium">
                  {updateStatus.latestVersion ? `v${updateStatus.latestVersion}` : '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-dark-muted">Last check</span>
                <span className="text-xs">
                  {updateStatus.checkedAt ? new Date(updateStatus.checkedAt).toLocaleString() : 'Never'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-dark-muted">Auto-update</span>
                <span className={updateStatus.executorAvailable ? 'text-green-600' : 'text-amber-600'}>
                  {updateStatus.executorAvailable ? 'Ready' : 'Unavailable'}
                </span>
              </div>
              {!updateStatus.executorAvailable && updateStatus.executorReason && (
                <p className="text-xs text-amber-600 pt-1">{updateStatus.executorReason}</p>
              )}
            </div>
          )}

          {updateStatus?.activeJob && (
            <div className="rounded-md border border-brand-200 dark:border-brand-800 p-3">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="text-sm font-medium">
                  {updateStatus.activeJob.status === 'queued' ? 'Update queued' : 'Update in progress'}: v
                  {updateStatus.activeJob.targetVersion}
                </div>
                <button
                  className="btn-secondary !py-1 !px-2 text-xs"
                  onClick={cancelUpdate}
                  disabled={cancellingUpdate}
                >
                  {cancellingUpdate ? 'Cancelling…' : 'Cancel'}
                </button>
              </div>
              {updateStatus.activeJob.error && (
                <p className="text-xs text-red-600 mb-2">{updateStatus.activeJob.error}</p>
              )}
              <ul className="space-y-1 text-xs">
                {updateStatus.activeJob.steps.map((step) => (
                  <li key={step.id} className="flex justify-between gap-2">
                    <span>{step.label}</span>
                    <span className={
                      step.status === 'completed' ? 'text-green-600' :
                      step.status === 'failed' ? 'text-red-600' :
                      step.status === 'running' ? 'text-brand-600' : 'text-dark-muted'
                    }>
                      {step.status}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button className="btn-secondary" onClick={checkUpdatesNow} disabled={checkingUpdates}>
              <RefreshCw className={`w-4 h-4 ${checkingUpdates ? 'animate-spin' : ''}`} />
              {checkingUpdates ? 'Checking…' : 'Check now'}
            </button>
            {updateStatus?.executorAvailable && !updateStatus.activeJob && (
              <button className="btn-primary" onClick={applyUpdateNow} disabled={applyingUpdate}>
                <ArrowUpCircle className="w-4 h-4" />
                {applyingUpdate ? 'Starting…' : 'Update now'}
              </button>
            )}
          </div>

          {updateSettings && (
            <>
              <Field label="GitHub repository" hint="owner/repo for release checks">
                <input
                  className="input font-mono"
                  value={updateSettings.githubRepo}
                  onChange={(e) => setUpdateSettings({ ...updateSettings, githubRepo: e.target.value })}
                />
              </Field>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={updateSettings.checkEnabled}
                  onChange={(e) => setUpdateSettings({ ...updateSettings, checkEnabled: e.target.checked })}
                />
                Periodically check GitHub for new releases
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={updateSettings.notifyEnabled}
                  onChange={(e) => setUpdateSettings({ ...updateSettings, notifyEnabled: e.target.checked })}
                />
                Show in-app notification when update is available
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={updateSettings.autoUpdateEnabled}
                  onChange={(e) => setUpdateSettings({ ...updateSettings, autoUpdateEnabled: e.target.checked })}
                />
                Automatically install updates on schedule
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={updateSettings.includePrerelease}
                  onChange={(e) => setUpdateSettings({ ...updateSettings, includePrerelease: e.target.checked })}
                />
                Include pre-releases
              </label>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Check interval (hours)">
                  <input
                    type="number"
                    className="input"
                    min={1}
                    max={168}
                    value={updateSettings.checkIntervalHours}
                    onChange={(e) =>
                      setUpdateSettings({
                        ...updateSettings,
                        checkIntervalHours: parseInt(e.target.value, 10) || 24,
                      })
                    }
                  />
                </Field>
                <Field label="Auto-update interval (hours)">
                  <input
                    type="number"
                    className="input"
                    min={1}
                    max={720}
                    value={updateSettings.autoUpdateIntervalHours}
                    onChange={(e) =>
                      setUpdateSettings({
                        ...updateSettings,
                        autoUpdateIntervalHours: parseInt(e.target.value, 10) || 168,
                      })
                    }
                  />
                </Field>
              </div>
              <button className="btn-primary w-full justify-center" onClick={saveUpdateSettings} disabled={updateSaving}>
                <Save className="w-4 h-4" /> {updateSaving ? 'Saving…' : 'Save update settings'}
              </button>
            </>
          )}

          <p className="text-xs text-dark-muted">
            Works out of the box with <code className="text-xs">docker compose up -d --build</code> on a local PC or VPS.
            Deploy from a git clone or release archive — updates are applied automatically with rollback on failure.
          </p>
          </>
          )}
        </SettingSection>

        <SettingSection title="Pagination & Display" icon={Globe}>
          <Field label="Application name">
            <input className="input" value={settings.appName}
              onChange={(e) => setSettings({ ...settings, appName: e.target.value })} />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Logs / page">
              <input type="number" className="input" min={5} max={200}
                value={settings.logsPerPage}
                onChange={(e) => setSettings({ ...settings, logsPerPage: parseInt(e.target.value) || 50 })} />
            </Field>
            <Field label="Users / page">
              <input type="number" className="input" min={5} max={100}
                value={settings.usersPerPage}
                onChange={(e) => setSettings({ ...settings, usersPerPage: parseInt(e.target.value) || 20 })} />
            </Field>
            <Field label="Endpoints / page">
              <input type="number" className="input" min={5} max={200}
                value={settings.endpointsPerPage}
                onChange={(e) => setSettings({ ...settings, endpointsPerPage: parseInt(e.target.value) || 50 })} />
            </Field>
          </div>
          <Field label="Default theme">
            <select className="select" value={settings.defaultTheme}
              onChange={(e) => setSettings({ ...settings, defaultTheme: e.target.value })}>
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
          </Field>
        </SettingSection>
      </div>
    </div>
  );
}
