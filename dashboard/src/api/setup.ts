import { apiListCatalog } from './client';
import { findCrmSetting, listCrmSettings, saveCrmSetting } from './crmSettings';
import type { SetupSettings, User, PostSettings } from '../types';

const SETUP_KEY = 'setup';

export function parseSetupSettings(raw: Record<string, unknown> | undefined): SetupSettings {
  return {
    complete: raw?.complete === true,
    completedAt: typeof raw?.completedAt === 'string' ? raw.completedAt : undefined,
    completedBy:
      raw?.completedBy && typeof raw.completedBy === 'object'
        ? {
            userId: String((raw.completedBy as { userId?: string }).userId ?? ''),
            login: String((raw.completedBy as { login?: string }).login ?? ''),
          }
        : undefined,
    skippedSteps: Array.isArray(raw?.skippedSteps)
      ? raw!.skippedSteps.map((s) => String(s))
      : [],
  };
}

export async function loadSetupSettings(): Promise<{ settings: SetupSettings; settingId: string | null }> {
  const list = await listCrmSettings();
  const row = findCrmSetting(list, SETUP_KEY);
  if (!row) {
    return { settings: { complete: false, skippedSteps: [] }, settingId: null };
  }
  return { settings: parseSetupSettings(row.value), settingId: row.id };
}

export async function saveSetupSettings(
  value: SetupSettings,
  settingId: string | null
): Promise<SetupSettings> {
  const saved = await saveCrmSetting(SETUP_KEY, value as unknown as Record<string, unknown>, settingId);
  return parseSetupSettings(saved.value);
}

export async function markSetupComplete(
  user: User,
  settingId: string | null,
  current: SetupSettings,
  skippedSteps: string[]
): Promise<SetupSettings> {
  return saveSetupSettings(
    {
      ...current,
      complete: true,
      completedAt: new Date().toISOString(),
      completedBy: { userId: user.id, login: user.login },
      skippedSteps,
    },
    settingId
  );
}

export async function checkApiHealth(): Promise<boolean> {
  try {
    const res = await fetch('/api/health', { method: 'GET' });
    return res.ok;
  } catch {
    return false;
  }
}

export async function loadSetupCatalogs() {
  const [washes, posts, currencies, workModes, discountTypes] = await Promise.all([
    apiListCatalog<{ id: string; name: string; address?: string }>('/crm/washes'),
    apiListCatalog<{ id: string; name: string; serialNumber: string; washId?: string | { id?: string }; settings?: PostSettings }>(
      '/crm/posts'
    ),
    apiListCatalog<{ id: string; code: string; name: string; symbol: string; isDefault?: boolean }>(
      '/crm/currencies'
    ),
    apiListCatalog<{ id: string; code: string; name: string }>('/crm/work-modes'),
    apiListCatalog<{ id: string; code: string; name: string }>('/crm/discount-types'),
  ]);
  return { washes, posts, currencies, workModes, discountTypes };
}
