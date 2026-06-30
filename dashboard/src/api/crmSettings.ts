import { api, apiList } from './client';
import type { CrmSetting } from '../types';

export async function listCrmSettings(): Promise<CrmSetting[]> {
  return apiList<CrmSetting>('/crm/settings');
}

export async function saveCrmSetting(
  key: string,
  value: Record<string, unknown>,
  id: string | null
): Promise<CrmSetting> {
  if (id) {
    return api<CrmSetting>(`/crm/settings/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ key, value }),
    });
  }
  return api<CrmSetting>('/crm/settings', {
    method: 'POST',
    body: JSON.stringify({ key, value }),
  });
}

export function findCrmSetting(settings: CrmSetting[], key: string): CrmSetting | undefined {
  return settings.find((s) => s.key === key);
}
