import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { readdir, stat, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import cron from 'node-cron';
import fetch from 'node-fetch';
import { pino } from 'pino';

import { startBackupHttpServer } from './http.js';
import {
  runGroupArchiveJob,
  runScheduledArchives,
  runTelemetryArchiveJob,
} from './archive-runner.js';
import { fetchArchiveSettings, normalizeArchiveSettings } from './archive-settings.js';
import { syncArchiveSchedules } from './archive-scheduler.js';
import { createFullBundleExtras, isFullBundleEnabled } from './bundle.js';
import {
  channelsFromSettings,
  DEFAULT_NOTIFICATION_SETTINGS,
  isNotificationTypeEnabled,
  normalizeNotificationSettings,
} from './notification-settings.js';

const execAsync = promisify(exec);
const logger = pino({ level: 'info' });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://mongodb:27017/dynamic_api';
const API_URL = process.env.API_URL || 'http://dynamic-api:3001';
const SERVICE_LOGIN = process.env.SERVICE_LOGIN || 'service';
const SERVICE_PASSWORD = process.env.SERVICE_PASSWORD || 'ServiceInternal123!';
const BACKUP_DIR = process.env.BACKUP_DIR || '/backups';
const RETENTION = parseInt(process.env.BACKUP_RETENTION_COUNT || '7', 10);
const CRON = process.env.BACKUP_CRON || '0 2 * * *';
const ARCHIVE_CRON = process.env.ARCHIVE_CRON || '0 3 * * *';

async function getToken(): Promise<string> {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: SERVICE_LOGIN, password: SERVICE_PASSWORD }),
  });
  const json = (await res.json()) as { success: boolean; data?: { accessToken: string } };
  if (!json.success || !json.data?.accessToken) throw new Error('Service login failed');
  return json.data.accessToken;
}

async function registerBackup(
  token: string,
  data: Record<string, unknown>
): Promise<string | null> {
  const res = await fetch(`${API_URL}/api/crm/backups`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  const json = (await res.json()) as { success: boolean; data?: { id: string } };
  return json.success && json.data ? json.data.id : null;
}

async function updateBackup(token: string, id: string, data: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${API_URL}/api/crm/backups/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  const json = (await res.json()) as { success?: boolean; error?: string };
  if (!res.ok || json.success === false) {
    throw new Error(json.error || `Backup update failed (${res.status})`);
  }
}

async function notifyCrm(
  token: string,
  type: string,
  message: string,
  severity: 'info' | 'warning' | 'error' = 'info'
): Promise<void> {
  let settings = DEFAULT_NOTIFICATION_SETTINGS;
  try {
    const settingsRes = await fetch(`${API_URL}/api/crm/settings`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const settingsJson = (await settingsRes.json()) as {
      success: boolean;
      data?: Array<{ key: string; value: unknown }>;
    };
    const row = settingsJson.data?.find((s) => s.key === 'notifications');
    if (row) settings = normalizeNotificationSettings(row.value);
  } catch {
    // defaults
  }

  if (!isNotificationTypeEnabled(type, settings)) return;

  const channels = channelsFromSettings(settings);
  if (!channels.length) return;

  await fetch(`${API_URL}/api/crm/notifications`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      type,
      severity,
      message,
      read: false,
      channels,
      createdAt: new Date().toISOString(),
    }),
  });
}

async function cleanupOldBackups(): Promise<void> {
  const files = (await readdir(BACKUP_DIR))
    .filter((f) => f.endsWith('.gz') || f.endsWith('.archive'))
    .sort();

  const mongoArchives = files.filter((f) => f.includes('.archive.gz') && !f.endsWith('-extras.tar.gz'));

  while (mongoArchives.length > RETENTION) {
    const oldest = mongoArchives.shift()!;
    await unlink(join(BACKUP_DIR, oldest));
    const extras = oldest.replace(/\.archive\.gz$/, '-extras.tar.gz');
    try {
      await unlink(join(BACKUP_DIR, extras));
    } catch {
      // no extras file
    }
    logger.info({ file: oldest }, 'Removed old backup');
  }
}

export async function runBackup(type: 'manual' | 'auto' = 'auto', existingRecordId?: string): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `wash-pro-crm-${timestamp}.archive.gz`;
  const filepath = join(BACKUP_DIR, filename);
  let token = '';
  let recordId: string | null = existingRecordId ?? null;

  try {
    token = await getToken();
    if (recordId) {
      await updateBackup(token, recordId, {
        filename,
        type: 'manual',
        status: 'in_progress',
        createdAt: new Date().toISOString(),
      });
    } else {
      recordId = await registerBackup(token, {
        filename,
        type,
        status: 'in_progress',
        createdAt: new Date().toISOString(),
      });
    }

    const cmd = `mongodump --uri="${MONGODB_URI}" --archive="${filepath}" --gzip`;
    await execAsync(cmd);

    const fileStat = await stat(filepath);
    if (recordId) {
      await updateBackup(token, recordId, {
        filename,
        status: 'completed',
        size: fileStat.size,
      });
    }

    await cleanupOldBackups();

    let extrasFilename: string | null = null;
    if (await isFullBundleEnabled(token, API_URL)) {
      const baseName = filename.replace(/\.archive\.gz$/, '');
      extrasFilename = await createFullBundleExtras(token, API_URL, baseName);
    }

    logger.info({ filename, size: fileStat.size, extrasFilename }, 'Backup completed');
    const successType = type === 'auto' ? 'auto_backup' : 'backup_success';
    const extrasNote = extrasFilename ? ` + ${extrasFilename}` : '';
    const successLabel = type === 'auto' ? 'Автоматическое резервное копирование выполнено' : 'Резервное копирование выполнено';
    await notifyCrm(token, successType, `${successLabel}: ${filename} (${fileStat.size} байт)${extrasNote}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown backup error';
    logger.error({ err }, 'Backup failed');
    try {
      if (!token) token = await getToken();
      if (recordId) {
        await updateBackup(token, recordId, { filename, status: 'failed', error: message });
      }
      const errorType = 'backup_error';
      await notifyCrm(token, errorType, `Ошибка резервного копирования: ${message}`, 'error');
    } catch {
      // best effort
    }
  }
}

export async function restoreBackup(filename: string): Promise<void> {
  const filepath = join(BACKUP_DIR, filename);
  const cmd = `mongorestore --uri="${MONGODB_URI}" --archive="${filepath}" --gzip --drop`;
  await execAsync(cmd);
  logger.info({ filename }, 'Restore completed');
}

async function refreshArchiveSchedules(): Promise<void> {
  try {
    const token = await getToken();
    const settings = (await fetchArchiveSettings(token, API_URL)) ?? normalizeArchiveSettings({});
    syncArchiveSchedules(settings, {
      telemetry: async () => {
        try {
          const jobToken = await getToken();
          const latest = (await fetchArchiveSettings(jobToken, API_URL)) ?? normalizeArchiveSettings({});
          await runTelemetryArchiveJob(jobToken, latest);
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown archive error';
          logger.error({ err }, 'Scheduled telemetry archive failed');
          try {
            const notifyToken = await getToken();
            await notifyCrm(notifyToken, 'archive_error', `Ошибка автоархивирования (телеметрия): ${message}`, 'error');
          } catch {
            // best effort
          }
        }
      },
      cards: async () => {
        await runScheduledGroupArchive('cards');
      },
      postStates: async () => {
        await runScheduledGroupArchive('postStates');
      },
      usageStats: async () => {
        await runScheduledGroupArchive('usageStats');
      },
      financeStats: async () => {
        await runScheduledGroupArchive('financeStats');
      },
    });
  } catch (err) {
    logger.error({ err }, 'Failed to refresh archive schedules');
  }
}

async function runScheduledGroupArchive(
  groupKey: 'cards' | 'postStates' | 'usageStats' | 'financeStats'
): Promise<void> {
  try {
    const token = await getToken();
    const settings = (await fetchArchiveSettings(token, API_URL)) ?? normalizeArchiveSettings({});
    const group = settings[groupKey];
    if (!group) return;
    await runGroupArchiveJob(token, groupKey, group);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Archive group failed';
    logger.error({ err, groupKey }, 'Scheduled group archive failed');
    try {
      const token = await getToken();
      await notifyCrm(token, 'archive_error', `Ошибка автоархивирования (${groupKey}): ${message}`, 'error');
    } catch {
      // best effort
    }
  }
}

async function runArchiveJob(): Promise<void> {
  try {
    const token = await getToken();
    await runScheduledArchives(token);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown archive error';
    logger.error({ err }, 'Archive run failed');
    try {
      const token = await getToken();
      await notifyCrm(token, 'archive_error', `Ошибка автоархивирования: ${message}`, 'error');
    } catch {
      // best effort
    }
  }
}

async function checkManualBackups(): Promise<void> {
  try {
    const token = await getToken();
    const res = await fetch(`${API_URL}/api/crm/backups`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = (await res.json()) as {
      success: boolean;
      data?: Array<{ id: string; type: string; status: string; filename?: string }>;
    };
    const pending = (json.data || []).find(
      (b) =>
        b.type === 'manual' &&
        b.status === 'in_progress' &&
        String(b.filename || '').endsWith('.pending')
    );
    if (pending) {
      await runBackup('manual', pending.id);
    }
  } catch {
    // ignore
  }
}

async function main(): Promise<void> {
  logger.info({ cron: CRON, archiveCron: ARCHIVE_CRON, retention: RETENTION }, 'Backup service starting');
  startBackupHttpServer();

  if (cron.validate(CRON)) {
    cron.schedule(CRON, () => runBackup('auto'));
  }

  void refreshArchiveSchedules();
  setInterval(() => {
    void refreshArchiveSchedules();
  }, 60_000);
  void checkManualBackups();
  setInterval(() => checkManualBackups(), 15000);
}

main().catch((err) => {
  logger.error({ err }, 'Backup service fatal');
  process.exit(1);
});
