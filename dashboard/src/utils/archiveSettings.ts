import type { ArchiveGroupSettings, ArchiveSettings } from '../types';

export const DEFAULT_ARCHIVE_CRON = '0 3 * * *';

export const ARCHIVE_GROUPS: Array<keyof Pick<ArchiveSettings, 'cards' | 'postStates' | 'usageStats' | 'financeStats'>> = [
  'cards',
  'postStates',
  'usageStats',
  'financeStats',
];

const defaultGroup = (): ArchiveGroupSettings => ({
  enabled: true,
  autoRun: false,
  saveArchive: true,
  deleteAfter: false,
  retentionDays: 90,
  policy: 'standard',
  cron: DEFAULT_ARCHIVE_CRON,
});

export function normalizeArchiveSettings(raw: Record<string, unknown> = {}): ArchiveSettings {
  const base: ArchiveSettings = {
    retentionDays: Number(raw.retentionDays) || 90,
    autoArchive: raw.autoArchive !== false,
    autoDelete: raw.autoDelete === false ? false : raw.autoDelete === true,
    cron: typeof raw.cron === 'string' && raw.cron.trim() ? raw.cron.trim() : DEFAULT_ARCHIVE_CRON,
  };
  for (const g of ARCHIVE_GROUPS) {
    const existing = raw[g] as ArchiveGroupSettings | undefined;
    base[g] = existing
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

export function resolveArchiveGroupLabel(
  details: Record<string, unknown> | undefined,
  t: (key: string) => string
): string {
  const key =
    (typeof details?.group === 'string' && details.group) ||
    (typeof details?.groupKey === 'string' && details.groupKey) ||
    (typeof details?.entity === 'string' && details.entity) ||
    '';
  if (key === 'telemetry') return t('pages.archive.groups.telemetry');
  if (ARCHIVE_GROUPS.includes(key as (typeof ARCHIVE_GROUPS)[number])) {
    return t(`pages.archive.groups.${key}`);
  }
  return key || t('common.notAvailable');
}
