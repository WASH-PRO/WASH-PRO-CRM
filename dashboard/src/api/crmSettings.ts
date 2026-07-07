import { api, apiListCatalog, clearCatalogCache } from './client';
import type { CrmSetting } from '../types';

export async function listCrmSettings(): Promise<CrmSetting[]> {
  return apiListCatalog<CrmSetting>('/crm/settings');
}

export async function saveCrmSetting(
  key: string,
  value: Record<string, unknown>,
  id: string | null
): Promise<CrmSetting> {
  if (id) {
    const result = await api<CrmSetting>(`/crm/settings/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ key, value }),
    });
    clearCatalogCache('/crm/settings');
    return result;
  }
  const result = await api<CrmSetting>('/crm/settings', {
    method: 'POST',
    body: JSON.stringify({ key, value }),
  });
  clearCatalogCache('/api/crm/settings');
  return result;
}

export function findCrmSetting(settings: CrmSetting[], key: string): CrmSetting | undefined {
  return settings.find((s) => s.key === key);
}
