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

function parseTime(value?: string | number | null): number | null {
  if (value == null || value === '') return null;
  if (typeof value === 'number') return Number.isNaN(value) ? null : value;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : t;
}

function effectivePublishTime(row: InfoMessage): number | null {
  const publishedAt = parseTime(row.publishedAt);
  if (publishedAt != null) return publishedAt;
  if (String(row.status ?? '').trim().toLowerCase() === 'published') {
    return parseTime(row.updatedAt) ?? parseTime(row.createdAt);
  }
  return null;
}

/** Фактический статус для UI: scheduled + прошедшая дата → published (зелёный бейдж). */
export function resolveInfoMessageDisplayStatus(row: InfoMessage, now = Date.now()): InfoMessageDisplayStatus {
  const raw = String(row.status ?? 'draft').trim().toLowerCase();

  if (raw === 'published') return 'published';

  if (raw === 'scheduled') {
    const publishTime = effectivePublishTime(row);
    // Без даты — считаем уже опубликованным (как в боте)
    if (publishTime == null || publishTime <= now) return 'published';
    return 'scheduled';
  }

  return 'draft';
}

export function isInfoMessageLive(row: InfoMessage, now = Date.now()): boolean {
  return resolveInfoMessageDisplayStatus(row, now) === 'published';
}
