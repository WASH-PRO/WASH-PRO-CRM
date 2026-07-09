import { api, apiList, getToken } from '../api/client';
import type { ArchiveGroupSettings } from '../types';
import { protectedLatestStatIds } from './statsAggregation';
import { tGlobal } from '../i18n/runtime';

export type ArchiveGroupKey = 'cards' | 'postStates' | 'usageStats' | 'financeStats';

export interface ArchiveRunResult {
  affected: number;
  filename?: string;
}

const GROUP_CONFIG: Record<ArchiveGroupKey, { path: string; dateField: string }> = {
  cards: { path: '/crm/cards', dateField: 'createdAt' },
  postStates: { path: '/crm/post-states', dateField: 'lastMessageAt' },
  usageStats: { path: '/crm/usage-stats', dateField: 'recordedAt' },
  financeStats: { path: '/crm/finance-stats', dateField: 'recordedAt' },
};

function recordDate(item: Record<string, unknown>, dateField: string): Date | null {
  const raw = (item[dateField] ?? item.createdAt) as string | undefined;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Удаляет (или только считает) записи старше retentionDays. */
export async function executeArchiveGroup(
  groupKey: ArchiveGroupKey,
  group: ArchiveGroupSettings
): Promise<ArchiveRunResult> {
  const config = GROUP_CONFIG[groupKey];
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - group.retentionDays);

  const items = await apiList<Record<string, unknown> & { id: string }>(config.path);
  const protectedIds =
    groupKey === 'usageStats' || groupKey === 'financeStats' || groupKey === 'postStates'
      ? protectedLatestStatIds(groupKey, items as Array<{ id: string; postId?: string; category?: string }>)
      : new Set<string>();

  const expired = items.filter((item) => {
    if (protectedIds.has(item.id)) return false;
    const d = recordDate(item, config.dateField);
    return d != null && d.getTime() < cutoff.getTime();
  });

  let filename: string | undefined;
  if (group.saveArchive && expired.length > 0) {
    const token = getToken();
    const res = await fetch('/api/crm/backup-files/archives', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        groupKey,
        policyDays: group.retentionDays,
        records: expired,
      }),
    });
    if (!res.ok) {
      throw new Error(tGlobal('archive.errors.saveFile'));
    }
    const json = (await res.json()) as { filename?: string; data?: { filename?: string } };
    filename = json.filename ?? json.data?.filename;
  }

  if (group.deleteAfter) {
    for (const item of expired) {
      await api(`${config.path}/${item.id}`, { method: 'DELETE' });
    }
  }

  return { affected: expired.length, filename };
}
