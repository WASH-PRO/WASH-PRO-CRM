import { fetchWithAuth } from './client';
import { modulesBridgeUnavailableHint, normalizeModulesError } from '../utils/modulesError';

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

type BridgePayload<T> = { success?: boolean; data?: T; error?: string };

function parseBridgeJson<T>(text: string): T {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error(modulesBridgeUnavailableHint());
  }

  let json: BridgePayload<T>;
  try {
    json = JSON.parse(trimmed) as BridgePayload<T>;
  } catch {
    const preview = trimmed.replace(/\s+/g, ' ').slice(0, 160);
    if (preview.startsWith('<') || /<!DOCTYPE/i.test(preview)) {
      throw new Error(modulesBridgeUnavailableHint());
    }
    if (preview === 'Unauthorized' || preview === 'Forbidden') {
      throw new Error(preview);
    }
    throw new Error(preview || modulesBridgeUnavailableHint());
  }

  if (json.success !== true) {
    throw new Error(json.error || modulesBridgeUnavailableHint());
  }

  return json.data as T;
}

async function readBridgeResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!res.ok && !text.trim()) {
    throw new Error(modulesBridgeUnavailableHint());
  }
  return parseBridgeJson<T>(text);
}

async function bridgeFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  try {
    const res = await fetchWithAuth(`${BASE}${path}`, options);
    return readBridgeResponse<T>(res);
  } catch (err) {
    throw new Error(normalizeModulesError(err));
  }
}

export async function checkModulesBridgeHealth(): Promise<{ pyorchAvailable: boolean }> {
  try {
    const res = await fetch(`${BASE}/health`);
    const data = await readBridgeResponse<{ pyorchAvailable: boolean }>(res);
    return data ?? { pyorchAvailable: false };
  } catch (err) {
    throw new Error(normalizeModulesError(err));
  }
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

export function moduleHelpUrl(moduleId: string, locale: 'en' | 'ru' = 'en'): string {
  const helpFile = locale === 'ru' ? 'help.ru.html' : 'help.html';
  return `${BASE}/ui/${encodeURIComponent(moduleId)}/${helpFile}`;
}

export async function getModuleStatus(moduleId: string): Promise<{
  state: InstalledModuleState | null;
  settings: Record<string, unknown>;
  snapshot: unknown;
}> {
  return bridgeFetch(`/installed/${encodeURIComponent(moduleId)}/status`);
}
