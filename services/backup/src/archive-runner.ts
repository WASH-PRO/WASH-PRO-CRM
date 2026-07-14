import { gzipSync } from 'node:zlib';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import fetch from 'node-fetch';
import { pino } from 'pino';
import {
  channelsFromSettings,
  DEFAULT_NOTIFICATION_SETTINGS,
  isNotificationTypeEnabled,
  normalizeNotificationSettings,
} from './notification-settings.js';
import {
  ArchiveGroupKey,
  ArchiveGroupSettings,
  ArchiveSettings,
  fetchArchiveSettings,
  normalizeArchiveSettings,
} from './archive-settings.js';

const logger = pino({ level: 'info' });

const API_URL = process.env.API_URL || 'http://dynamic-api:3001';
const ARCHIVE_DIR = join(process.env.BACKUP_DIR || '/backups', 'archives');

export type { ArchiveGroupKey, ArchiveGroupSettings, ArchiveSettings };
export { fetchArchiveSettings, normalizeArchiveSettings };

const GROUP_CONFIG: Record<ArchiveGroupKey, { path: string; dateField: string }> = {
  cards: { path: '/api/crm/cards', dateField: 'createdAt' },
  postStates: { path: '/api/crm/post-states', dateField: 'lastMessageAt' },
  usageStats: { path: '/api/crm/usage-stats', dateField: 'recordedAt' },
  financeStats: { path: '/api/crm/finance-stats', dateField: 'recordedAt' },
};

const GROUP_LABELS: Record<ArchiveGroupKey, string> = {
  cards: 'карты',
  postStates: 'состояния постов',
  usageStats: 'статистика использования',
  financeStats: 'финансовая статистика',
};

function refId(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'object') {
    const obj = value as { id?: string; _id?: string };
    return String(obj.id ?? obj._id ?? '');
  }
  return String(value);
}

function recordTime(item: Record<string, unknown>, dateField: string): number {
  const raw = (item[dateField] ?? item.createdAt) as string | undefined;
  if (!raw) return 0;
  const t = new Date(raw).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function protectedLatestStatIds(
  groupKey: ArchiveGroupKey,
  items: Array<{ id: string; postId?: unknown; period?: string; category?: string; lastMessageAt?: string; recordedAt?: string; createdAt?: string }>
): Set<string> {
  const byKey = new Map<string, (typeof items)[0]>();
  for (const row of items) {
    const postKey = refId(row.postId) || row.id;
    let key = postKey;
    if (groupKey === 'financeStats') {
      key = `${postKey}:${row.period || 'before_collection'}`;
    } else if (groupKey === 'usageStats') {
      key = `${postKey}:${row.period || 'before_collection'}:${row.category || 'regular'}`;
    }
    const prev = byKey.get(key);
    const rowTime = recordTime(row as Record<string, unknown>, GROUP_CONFIG[groupKey].dateField);
    const prevTime = prev ? recordTime(prev as Record<string, unknown>, GROUP_CONFIG[groupKey].dateField) : -1;
    if (!prev || rowTime >= prevTime) {
      byKey.set(key, row);
    }
  }
  return new Set([...byKey.values()].map((r) => r.id));
}

async function apiListAll<T>(token: string, path: string): Promise<T[]> {
  const all: T[] = [];
  let page = 1;
  let totalPages = 1;
  while (page <= totalPages) {
    const res = await fetch(`${API_URL}${path}?page=${page}&limit=100`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = (await res.json()) as {
      success?: boolean;
      data?: T[];
      pagination?: { totalPages: number };
    };
    if (!json.success) break;
    const chunk = json.data ?? [];
    all.push(...chunk);
    totalPages = json.pagination?.totalPages ?? 1;
    if (chunk.length === 0) break;
    page += 1;
  }
  return all;
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

async function saveArchiveFile(
  groupKey: ArchiveGroupKey,
  policyDays: number,
  records: unknown[]
): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${groupKey}-${timestamp}.json.gz`;
  await mkdir(ARCHIVE_DIR, { recursive: true });
  const payload = gzipSync(
    JSON.stringify({
      groupKey,
      policyDays,
      createdAt: new Date().toISOString(),
      records,
    })
  );
  await writeFile(join(ARCHIVE_DIR, filename), payload);
  return filename;
}

export async function runArchiveGroup(
  token: string,
  groupKey: ArchiveGroupKey,
  group: ArchiveGroupSettings
): Promise<{ affected: number; filename?: string }> {
  const config = GROUP_CONFIG[groupKey];
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - group.retentionDays);

  const items = await apiListAll<{ id: string; postId?: unknown; period?: string; category?: string } & Record<string, unknown>>(
    token,
    config.path
  );

  const protectedIds =
    groupKey === 'cards'
      ? new Set<string>()
      : protectedLatestStatIds(groupKey, items);

  const expired = items.filter((item) => {
    if (protectedIds.has(item.id)) return false;
    const d = recordTime(item, config.dateField);
    return d > 0 && d < cutoff.getTime();
  });

  let filename: string | undefined;
  if (group.saveArchive && expired.length > 0) {
    filename = await saveArchiveFile(groupKey, group.retentionDays, expired);
  }

  if (group.deleteAfter) {
    for (const item of expired) {
      await fetch(`${API_URL}${config.path}/${item.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
    }
  }

  return { affected: expired.length, filename };
}

export async function runTelemetryArchive(
  token: string,
  retentionDays: number
): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);

  const res = await fetch(`${API_URL}/api/crm/telemetry/purge-expired`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ receivedBefore: cutoff.toISOString() }),
  });
  const json = (await res.json()) as {
    success?: boolean;
    data?: { deleted?: number };
    error?: string;
  };
  if (!res.ok || json.success === false) {
    throw new Error(json.error || `Telemetry purge failed (${res.status})`);
  }
  return Number(json.data?.deleted ?? 0);
}

export async function runTelemetryArchiveJob(token: string, settings: ArchiveSettings): Promise<void> {
  if (settings.autoArchive === false) return;
  const retentionDays = settings.retentionDays ?? 90;
  const affected = await runTelemetryArchive(token, retentionDays);
  if (affected <= 0) return;

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
      details: { entity: 'telemetry', groupKey: 'telemetry' },
    }),
  });
  logger.info({ affected, retentionDays }, 'Telemetry archive completed');
  await notifyCrm(
    token,
    'auto_archive',
    `Автоархивирование: удалено ${affected} записей телеметрии (политика ${retentionDays} дн.)`
  );
}

export async function runGroupArchiveJob(
  token: string,
  groupKey: ArchiveGroupKey,
  group: ArchiveGroupSettings
): Promise<void> {
  if (!group.enabled || !group.autoRun) return;

  const result = await runArchiveGroup(token, groupKey, group);
  if (result.affected <= 0) return;

  await fetch(`${API_URL}/api/crm/archive-logs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      action: 'archive',
      recordsAffected: result.affected,
      policyDays: group.retentionDays,
      groupKey,
      filename: result.filename,
      createdAt: new Date().toISOString(),
      details: {
        groupKey,
        group: groupKey,
        filename: result.filename,
        saveArchive: group.saveArchive,
        deleteAfter: group.deleteAfter,
        autoRun: true,
      },
    }),
  });

  const label = GROUP_LABELS[groupKey];
  const filePart = result.filename ? `, файл ${result.filename}` : '';
  const deletePart = group.deleteAfter ? ', исходные данные удалены' : '';
  logger.info({ groupKey, affected: result.affected }, 'Group archive completed');
  await notifyCrm(
    token,
    'auto_archive',
    `Автоархивирование (${label}): ${result.affected} записей${filePart}${deletePart}`
  );
}

export async function runScheduledArchives(token: string): Promise<void> {
  const settings = (await fetchArchiveSettings(token, API_URL)) ?? normalizeArchiveSettings({});

  try {
    await runTelemetryArchiveJob(token, settings);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Telemetry archive failed';
    logger.error({ err }, 'Telemetry archive failed');
    await notifyCrm(token, 'archive_error', `Ошибка автоархивирования (телеметрия): ${message}`, 'error');
  }

  for (const groupKey of ['cards', 'postStates', 'usageStats', 'financeStats'] as ArchiveGroupKey[]) {
    const group = settings[groupKey]!;
    if (!group.enabled || !group.autoRun) continue;
    try {
      await runGroupArchiveJob(token, groupKey, group);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Archive group failed';
      logger.error({ err, groupKey }, 'Group archive failed');
      await notifyCrm(token, 'archive_error', `Ошибка автоархивирования (${GROUP_LABELS[groupKey]}): ${message}`, 'error');
    }
  }
}
