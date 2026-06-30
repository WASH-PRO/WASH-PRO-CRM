import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { readdir, stat, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import cron from 'node-cron';
import fetch from 'node-fetch';
import { pino } from 'pino';

import { startBackupHttpServer } from './http.js';
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
  await fetch(`${API_URL}/api/crm/backups/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
}

async function notifyBackupError(token: string, message: string): Promise<void> {
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

  if (!isNotificationTypeEnabled('backup_error', settings)) return;

  const channels = channelsFromSettings(settings);
  if (!channels.length) return;

  await fetch(`${API_URL}/api/crm/notifications`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      type: 'backup_error',
      severity: 'error',
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

  while (files.length > RETENTION) {
    const oldest = files.shift()!;
    await unlink(join(BACKUP_DIR, oldest));
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
        status: 'completed',
        size: fileStat.size,
      });
    }

    await cleanupOldBackups();
    logger.info({ filename, size: fileStat.size }, 'Backup completed');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown backup error';
    logger.error({ err }, 'Backup failed');
    try {
      if (!token) token = await getToken();
      if (recordId) {
        await updateBackup(token, recordId, { status: 'failed', error: message });
      }
      await notifyBackupError(token, `Ошибка резервного копирования: ${message}`);
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

async function runArchive(): Promise<void> {
  const token = await getToken();

  const settingsRes = await fetch(`${API_URL}/api/crm/settings`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const settingsJson = (await settingsRes.json()) as {
    success: boolean;
    data?: Array<{ key: string; id: string }>;
  };

  const archiveSetting = settingsJson.data?.find((s) => s.key === 'archive');
  if (!archiveSetting) return;

  const detailRes = await fetch(`${API_URL}/api/crm/settings/${(archiveSetting as { id: string }).id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const detail = (await detailRes.json()) as { data?: { value?: { retentionDays?: number; autoArchive?: boolean } } };
  const retentionDays = detail.data?.value?.retentionDays ?? 90;
  if (!detail.data?.value?.autoArchive) return;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);

  const telemetry = await fetch(`${API_URL}/api/crm/telemetry?limit=500`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const telemetryJson = (await telemetry.json()) as {
    success: boolean;
    data?: Array<{ id: string; receivedAt?: string }>;
  };

  let affected = 0;
  for (const record of telemetryJson.data || []) {
    if (record.receivedAt && new Date(record.receivedAt) < cutoff) {
      await fetch(`${API_URL}/api/crm/telemetry/${record.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      affected++;
    }
  }

  if (affected > 0) {
    await fetch(`${API_URL}/api/crm/archive-logs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        action: 'archive',
        recordsAffected: affected,
        policyDays: retentionDays,
        createdAt: new Date().toISOString(),
        details: { entity: 'telemetry' },
      }),
    });
    logger.info({ affected, retentionDays }, 'Archive run completed');
  }
}

async function checkManualBackups(): Promise<void> {
  try {
    const token = await getToken();
    const res = await fetch(`${API_URL}/api/crm/backups`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = (await res.json()) as { success: boolean; data?: Array<{ id: string; type: string; status: string }> };
    const pending = (json.data || []).find((b) => b.type === 'manual' && b.status === 'in_progress');
    if (pending) {
      await runBackup('manual', pending.id);
    }
  } catch {
    // ignore
  }
}

async function main(): Promise<void> {
  logger.info({ cron: CRON, retention: RETENTION }, 'Backup service starting');
  startBackupHttpServer();

  if (cron.validate(CRON)) {
    cron.schedule(CRON, () => runBackup('auto'));
  }

  cron.schedule('0 3 * * *', () => runArchive());
  void checkManualBackups();
  setInterval(() => checkManualBackups(), 15000);
}

main().catch((err) => {
  logger.error({ err }, 'Backup service fatal');
  process.exit(1);
});
