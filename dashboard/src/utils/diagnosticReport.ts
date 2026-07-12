import { api, apiList } from '../api/client';
import { getUpdatesStatus } from '../api/updates';
import type { BackupRecord, CrmSetting, SystemInfo } from '../types';
import type { UpdatesStatus } from '../api/updates';

export interface DiagnosticReport {
  generatedAt: string;
  system: SystemInfo | null;
  updates: UpdatesStatus | null;
  modulesHealth: { pyorchAvailable: boolean } | null;
  backups: BackupRecord[];
  settingsKeys: string[];
  userAgent: string;
  locale: string;
}

export async function buildDiagnosticReport(locale: string): Promise<DiagnosticReport> {
  const [system, updates, modulesHealth, backups, settings] = await Promise.all([
    api<SystemInfo>('/dashboard/system').catch(() => null),
    getUpdatesStatus(false).catch(() => null),
    fetch('/api/crm/modules/health')
      .then((r) => r.json())
      .then((j) => (j?.success ? j.data : null))
      .catch(() => null),
    apiList<BackupRecord>('/crm/backups?limit=20').catch(() => []),
    apiList<CrmSetting>('/crm/settings').catch(() => []),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    system,
    updates,
    modulesHealth,
    backups: backups.slice(0, 20),
    settingsKeys: settings.map((s) => s.key).sort(),
    userAgent: navigator.userAgent,
    locale,
  };
}

export function downloadDiagnosticReport(report: DiagnosticReport): void {
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `wash-pro-crm-diagnostics-${report.generatedAt.replace(/[:.]/g, '-')}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
