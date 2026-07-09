import type { InfoMessage } from '../types';

export type InfoMessageDisplayStatus = 'draft' | 'scheduled' | 'published';

export const INFO_MESSAGE_STATUS_LABELS: Record<InfoMessageDisplayStatus, string> = {
  draft: 'Черновик',
  scheduled: 'По расписанию',
  published: 'Опубликовано',
};

export const INFO_MESSAGE_STATUS_VARIANT: Record<InfoMessageDisplayStatus, 'default' | 'warning' | 'success'> = {
  draft: 'default',
  scheduled: 'warning',
  published: 'success',
};

function parseTime(iso?: string): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : t;
}

/** Фактический статус для UI и бота: scheduled + прошедшая дата → published. */
export function resolveInfoMessageDisplayStatus(row: InfoMessage, now = Date.now()): InfoMessageDisplayStatus {
  const raw = row.status ?? 'draft';
  const publishedAt = parseTime(row.publishedAt);

  if (raw === 'published') return 'published';

  if (raw === 'scheduled') {
    if (publishedAt != null && publishedAt <= now) return 'published';
    return 'scheduled';
  }

  return 'draft';
}

export function isInfoMessageLive(row: InfoMessage, now = Date.now()): boolean {
  return resolveInfoMessageDisplayStatus(row, now) === 'published';
}
