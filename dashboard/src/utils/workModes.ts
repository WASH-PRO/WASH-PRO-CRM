import type { WorkMode } from '../types';

export const WORK_MODE_STATUS_LABELS: Record<NonNullable<WorkMode['status']>, string> = {
  active: 'Активен',
  inactive: 'Неактивен',
};

export const WORK_MODE_TYPE_LABELS: Record<NonNullable<WorkMode['modeType']>, string> = {
  system: 'Системный',
  user: 'Пользовательский',
};

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
