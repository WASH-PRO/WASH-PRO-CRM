import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { InstalledModuleState, ModulesStateFile } from './types.js';
import { INSTALLED_DIR, STATE_FILE } from './paths.js';

let cache: ModulesStateFile | null = null;

function ensureDirs(): void {
  mkdirSync(INSTALLED_DIR, { recursive: true });
}

export function loadState(): ModulesStateFile {
  if (cache) return cache;
  ensureDirs();
  if (!existsSync(STATE_FILE)) {
    cache = { modules: [] };
    return cache;
  }
  try {
    const raw = readFileSync(STATE_FILE, 'utf8');
    cache = JSON.parse(raw) as ModulesStateFile;
    return cache;
  } catch {
    cache = { modules: [] };
    return cache;
  }
}

export function saveState(state: ModulesStateFile): void {
  ensureDirs();
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
  cache = state;
}

export function getInstalledState(moduleId: string): InstalledModuleState | null {
  const state = loadState();
  return state.modules.find((m) => m.id === moduleId) ?? null;
}

export function upsertInstalledState(entry: InstalledModuleState): InstalledModuleState {
  const state = loadState();
  const index = state.modules.findIndex((m) => m.id === entry.id);
  if (index >= 0) {
    state.modules[index] = entry;
  } else {
    state.modules.push(entry);
  }
  saveState(state);
  return entry;
}

export function removeInstalledState(moduleId: string): void {
  const state = loadState();
  state.modules = state.modules.filter((m) => m.id !== moduleId);
  saveState(state);
}

export function listInstalledStates(): InstalledModuleState[] {
  return loadState().modules;
}
