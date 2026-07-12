import { fetchWithAuth } from './client';

export interface LocalizedText {
  ru: string;
  en: string;
}

export interface ModuleSettingsField {
  key: string;
  type: 'number' | 'string' | 'boolean' | 'select';
  label: LocalizedText;
  default?: string | number | boolean;
  min?: number;
  max?: number;
  options?: Array<{ value: string; label: LocalizedText }>;
}

export interface CatalogModule {
  id: string;
  name: LocalizedText;
  description: LocalizedText;
  version: string;
  author: string;
  license: string;
  category: string;
  icon: string;
  iconUrl?: string;
  repository: string;
  dependencies: string[];
  minCrmVersion?: string;
  settingsSchema?: ModuleSettingsField[];
  installed: boolean;
  installedVersion?: string;
  installState?: 'installed' | 'running' | 'stopped' | 'error' | 'updating';
  activeRunStatus?: string | null;
}

export interface InstalledModuleState {
  id: string;
  version: string;
  repository: string;
  installedAt: string;
  updatedAt: string;
  pyorchScriptId?: string;
  status: 'installed' | 'running' | 'stopped' | 'error' | 'updating';
  lastError?: string;
}

const BASE = '/api/crm/modules';

async function bridgeFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetchWithAuth(`${BASE}${path}`, options);
  const json = (await res.json()) as { success?: boolean; data?: T; error?: string };
  if (!res.ok || json.success !== true) {
    throw new Error(json.error || `Request failed (${res.status})`);
  }
  return json.data as T;
}

export async function checkModulesBridgeHealth(): Promise<{ pyorchAvailable: boolean }> {
  const res = await fetch(`${BASE}/health`);
  const json = (await res.json()) as { success?: boolean; data?: { pyorchAvailable: boolean } };
  if (!res.ok || json.success !== true) {
    throw new Error('Modules bridge unavailable');
  }
  return json.data ?? { pyorchAvailable: false };
}

export async function listModuleCatalog(refresh = false): Promise<CatalogModule[]> {
  return bridgeFetch<CatalogModule[]>(`/catalog${refresh ? '?refresh=1' : ''}`);
}

export async function installModule(moduleId: string): Promise<InstalledModuleState> {
  return bridgeFetch<InstalledModuleState>(`/install/${encodeURIComponent(moduleId)}`, { method: 'POST' });
}

export async function uninstallModule(moduleId: string): Promise<void> {
  await bridgeFetch<void>(`/installed/${encodeURIComponent(moduleId)}`, { method: 'DELETE' });
}

export async function startModule(moduleId: string): Promise<InstalledModuleState> {
  return bridgeFetch<InstalledModuleState>(`/installed/${encodeURIComponent(moduleId)}/start`, { method: 'POST' });
}

export async function stopModule(moduleId: string): Promise<InstalledModuleState> {
  return bridgeFetch<InstalledModuleState>(`/installed/${encodeURIComponent(moduleId)}/stop`, { method: 'POST' });
}

export async function updateModule(moduleId: string): Promise<InstalledModuleState> {
  return bridgeFetch<InstalledModuleState>(`/installed/${encodeURIComponent(moduleId)}/update`, { method: 'POST' });
}

export function moduleUiUrl(moduleId: string): string {
  return `${BASE}/ui/${encodeURIComponent(moduleId)}/`;
}

export function moduleHelpUrl(moduleId: string): string {
  return `${BASE}/ui/${encodeURIComponent(moduleId)}/help.html`;
}

export async function getModuleStatus(moduleId: string): Promise<{
  state: InstalledModuleState | null;
  settings: Record<string, unknown>;
  snapshot: unknown;
}> {
  return bridgeFetch(`/installed/${encodeURIComponent(moduleId)}/status`);
}
