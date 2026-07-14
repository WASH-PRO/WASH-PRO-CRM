import fetch from 'node-fetch';

export const DEFAULT_ARCHIVE_CRON = '0 3 * * *';

export type ArchiveGroupKey = 'cards' | 'postStates' | 'usageStats' | 'financeStats';

export interface ArchiveGroupSettings {
  enabled: boolean;
  autoRun: boolean;
  saveArchive: boolean;
  deleteAfter: boolean;
  retentionDays: number;
  policy: string;
  cron?: string;
}

export interface ArchiveSettings {
  retentionDays?: number;
  autoArchive?: boolean;
  autoDelete?: boolean;
  cron?: string;
  cards?: ArchiveGroupSettings;
  postStates?: ArchiveGroupSettings;
  usageStats?: ArchiveGroupSettings;
  financeStats?: ArchiveGroupSettings;
}

function defaultGroup(): ArchiveGroupSettings {
  return {
    enabled: true,
    autoRun: false,
    saveArchive: true,
    deleteAfter: false,
    retentionDays: 90,
    policy: 'standard',
    cron: DEFAULT_ARCHIVE_CRON,
  };
}

export function normalizeArchiveSettings(raw: Record<string, unknown> = {}): ArchiveSettings {
  const base: ArchiveSettings = {
    retentionDays: Number(raw.retentionDays) || 90,
    autoArchive: raw.autoArchive !== false,
    autoDelete: raw.autoDelete === true,
    cron: typeof raw.cron === 'string' && raw.cron.trim() ? raw.cron.trim() : DEFAULT_ARCHIVE_CRON,
  };
  for (const key of ['cards', 'postStates', 'usageStats', 'financeStats'] as ArchiveGroupKey[]) {
    const existing = raw[key] as ArchiveGroupSettings | undefined;
    base[key] = existing
      ? {
          ...defaultGroup(),
          ...existing,
          cron:
            typeof existing.cron === 'string' && existing.cron.trim()
              ? existing.cron.trim()
              : DEFAULT_ARCHIVE_CRON,
        }
      : defaultGroup();
  }
  return base;
}

export async function fetchArchiveSettings(
  token: string,
  apiUrl: string
): Promise<ArchiveSettings | null> {
  const settingsRes = await fetch(`${apiUrl}/api/crm/settings`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const settingsJson = (await settingsRes.json()) as {
    success: boolean;
    data?: Array<{ key: string; id: string }>;
  };
  const archiveRow = settingsJson.data?.find((s) => s.key === 'archive');
  if (!archiveRow) return null;

  const detailRes = await fetch(`${apiUrl}/api/crm/settings/${archiveRow.id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const detail = (await detailRes.json()) as { data?: { value?: Record<string, unknown> } };
  return normalizeArchiveSettings(detail.data?.value ?? {});
}
