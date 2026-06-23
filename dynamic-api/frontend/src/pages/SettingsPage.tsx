import { useEffect, useState } from 'react';
import { Save, Trash2, Shield, Gauge, FileText, Globe, RefreshCw } from 'lucide-react';
import { api } from '../services/api';
import { AppSettings } from '../types';
import { PageHeader, LoadingSpinner } from '../components/UI';

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

  const load = () => {
    setLoading(true);
    api.getSettings()
      .then((data) => {
        setSettings(data.settings);
        setLogsCount(data.logsCount);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

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
