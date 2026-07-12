import { tGlobal } from '../i18n/runtime';

const SAFARI_JSON_PATTERN = /did not match the expected pattern|InvalidCharacterError|Unexpected EOF|JSON Parse error/i;

export function modulesBridgeUnavailableHint(): string {
  return tGlobal('pages.modules.bridgeRebuildHint');
}

/** Map Safari/WebKit fetch/json quirks to a user-facing modules hint. */
export function normalizeModulesError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err ?? '');
  const trimmed = raw.trim();
  if (!trimmed) return modulesBridgeUnavailableHint();
  if (SAFARI_JSON_PATTERN.test(trimmed)) return modulesBridgeUnavailableHint();
  if (trimmed.startsWith('<') || /<!DOCTYPE/i.test(trimmed)) return modulesBridgeUnavailableHint();
  return trimmed;
}
