import type { CardStatus } from '../types';
import { tGlobal } from '../i18n/runtime';

export type { CardStatus };

type TranslateFn = (key: string, params?: Record<string, string | number>) => string;

export function getCardStatusLabels(t: TranslateFn): Record<CardStatus, string> {
  return {
    success: t('cards.status.success'),
    rejected: t('cards.status.rejected'),
  };
}

export const CARD_STATUS_LABELS: Record<CardStatus, string> = getCardStatusLabels(tGlobal);

const LEGACY_SUCCESS = new Set(['active']);

/** Приводит статус карты к success | rejected. */
export function normalizeCardStatus(status: string): CardStatus {
  const value = String(status || '').trim().toLowerCase();
  if (value === 'success' || value === 'rejected') return value;
  if (LEGACY_SUCCESS.has(value)) return 'success';
  return 'rejected';
}

export function getCardStatusLabel(status: string): string {
  return getCardStatusLabels(tGlobal)[normalizeCardStatus(status)];
}

export function getCardStatusBadgeVariant(status: string): 'success' | 'error' {
  return normalizeCardStatus(status) === 'success' ? 'success' : 'error';
}

export function isCardStatus(value: string): value is CardStatus {
  return value === 'success' || value === 'rejected';
}

/** @deprecated используйте CARD_STATUS_LABELS */
export const cardStatusLabel = CARD_STATUS_LABELS;
