import type { WorkMode } from '../types';
import { tGlobal } from '../i18n/runtime';

type TranslateFn = (key: string, params?: Record<string, string | number>) => string;

export function getWorkModeStatusLabels(t: TranslateFn): Record<NonNullable<WorkMode['status']>, string> {
  return {
    active: t('workModes.status.active'),
    inactive: t('workModes.status.inactive'),
  };
}

export function getWorkModeTypeLabels(t: TranslateFn): Record<NonNullable<WorkMode['modeType']>, string> {
  return {
    system: t('workModes.type.system'),
    user: t('workModes.type.user'),
  };
}

export const WORK_MODE_STATUS_LABELS: Record<NonNullable<WorkMode['status']>, string> = getWorkModeStatusLabels(tGlobal);
export const WORK_MODE_TYPE_LABELS: Record<NonNullable<WorkMode['modeType']>, string> = getWorkModeTypeLabels(tGlobal);

export function workModeStatus(mode: WorkMode): NonNullable<WorkMode['status']> {
  return mode.status ?? 'active';
}

export function workModeType(mode: WorkMode): NonNullable<WorkMode['modeType']> {
  return mode.modeType ?? 'system';
}

export function normalizeWorkModeCode(code: string): string {
  return code.trim().toUpperCase();
}

export function workModesByCode(modes: WorkMode[]): Map<string, WorkMode> {
  return new Map(modes.map((m) => [normalizeWorkModeCode(m.code), m]));
}

/** Код, program_N или mode → название из справочника. */
export function resolveWorkModeLabel(
  modeRef: string | number | undefined,
  byCode: Map<string, WorkMode>
): string {
  if (modeRef == null || modeRef === '') return '—';

  const asString = String(modeRef).trim();
  const programMatch = /^program_(\d+)$/i.exec(asString);
  const candidates = new Set<string>();

  candidates.add(normalizeWorkModeCode(asString));
  if (programMatch) {
    candidates.add(normalizeWorkModeCode(programMatch[1]!));
    candidates.add(normalizeWorkModeCode(`PROGRAM_${programMatch[1]}`));
  }

  for (const key of candidates) {
    const mode = byCode.get(key);
    if (mode) return mode.name;
  }

  return asString;
}
