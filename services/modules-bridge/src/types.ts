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

export interface WashModuleManifest {
  id: string;
  name: LocalizedText;
  description: LocalizedText;
  version: string;
  author: string;
  license: string;
  category: string;
  icon: string;
  repository: string;
  dependencies: string[];
  minCrmVersion?: string;
  entrypoint: string;
  scriptType: 'daemon' | 'scheduled';
  helpPage?: string;
  settingsSchema?: ModuleSettingsField[];
}

export interface RegistryEntry {
  id: string;
  repository: string;
  defaultBranch?: string;
  manifest?: WashModuleManifest;
}

export interface ModuleRegistry {
  version: number;
  updatedAt?: string;
  catalogUrl?: string;
  modules: RegistryEntry[];
}

export interface CatalogModule extends WashModuleManifest {
  installed: boolean;
  installedVersion?: string;
  installState?: InstalledModuleState['status'];
  activeRunStatus?: string | null;
  iconUrl?: string;
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

export interface ModulesStateFile {
  modules: InstalledModuleState[];
}

export interface PyorchRunLog {
  id: number;
  ts: string;
  level: string;
  message: string;
}

export interface PyorchRunSummary {
  id: string;
  status: string;
  started_at?: string | null;
  finished_at?: string | null;
}

export interface ModuleLogsPayload {
  runId: string | null;
  runStatus: string | null;
  logs: PyorchRunLog[];
  unavailable?: string;
}

export interface PyorchScript {
  id: string;
  name: string;
  description: string;
  script_type: string;
  status: string;
  entrypoint?: string;
  metadata: Record<string, unknown>;
  active_run?: { id: string; status: string; started_at: string | null; queued_at: string } | null;
}
