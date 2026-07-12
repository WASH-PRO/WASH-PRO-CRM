import { execSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { pino } from 'pino';
import { findRegistryEntry, loadRegistry } from './catalog.js';
import {
  deleteModuleScript,
  isPyorchAvailable,
  registerModuleScript,
  startModuleScript,
  stopModuleScript,
  syncModuleSecrets,
} from './pyorch.js';
import {
  moduleDataDir,
  moduleDir,
  moduleSettingsPath,
} from './paths.js';
import {
  getInstalledState,
  listInstalledStates,
  removeInstalledState,
  upsertInstalledState,
} from './state.js';
import type { InstalledModuleState, WashModuleManifest } from './types.js';

import { readLocalManifest, isModuleInstalled } from './manifest.js';

const logger = pino({ level: 'info' });
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';

/** Settings keys that must be preserved when the client sends an empty value (token not re-sent). */
const SENSITIVE_SETTING_KEY = /(_token|_secret|_password|_api_key)$/i;

function mergeModuleSettings(
  existing: Record<string, unknown>,
  incoming: Record<string, unknown>
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...existing, ...incoming };
  for (const [key, value] of Object.entries(merged)) {
    if (value === undefined || value === null || value === '') {
      if (SENSITIVE_SETTING_KEY.test(key) && existing[key] !== undefined && existing[key] !== '') {
        merged[key] = existing[key];
      } else {
        delete merged[key];
      }
    }
  }
  return merged;
}

function defaultSettings(manifest: WashModuleManifest): Record<string, unknown> {
  const settings: Record<string, unknown> = {};
  for (const field of manifest.settingsSchema ?? []) {
    if (field.default !== undefined) {
      settings[field.key] = field.default;
    }
  }
  return settings;
}

export function readModuleSettings(moduleId: string): Record<string, unknown> {
  const path = moduleSettingsPath(moduleId);
  if (!existsSync(path)) {
    const manifest = readLocalManifest(moduleId);
    return manifest ? defaultSettings(manifest) : {};
  }
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function writeModuleSettings(moduleId: string, settings: Record<string, unknown>): void {
  const dir = moduleDataDir(moduleId);
  mkdirSync(dir, { recursive: true });
  writeFileSync(moduleSettingsPath(moduleId), JSON.stringify(settings, null, 2), 'utf8');
}

function cloneRepo(repo: string, branch: string, targetDir: string): void {
  rmSync(targetDir, { recursive: true, force: true });
  mkdirSync(join(targetDir, '..'), { recursive: true });
  const authPrefix = GITHUB_TOKEN ? `https://${GITHUB_TOKEN}@github.com/` : 'https://github.com/';
  const url = `${authPrefix}${repo}.git`;
  execSync(`git clone --depth 1 --branch ${branch} ${JSON.stringify(url)} ${JSON.stringify(targetDir)}`, {
    stdio: 'pipe',
    timeout: 120000,
  });
}

function readEntrypointCode(dir: string, entrypoint: string): string {
  const path = join(dir, entrypoint);
  if (!existsSync(path)) {
    throw new Error(`Entrypoint not found: ${entrypoint}`);
  }
  return readFileSync(path, 'utf8');
}

function checkDependencies(manifest: WashModuleManifest): void {
  for (const dep of manifest.dependencies ?? []) {
    if (!isModuleInstalled(dep)) {
      throw new Error(`Требуется модуль: ${dep}`);
    }
  }
}

export async function installModule(moduleId: string): Promise<InstalledModuleState> {
  if (isModuleInstalled(moduleId)) {
    const state = getInstalledState(moduleId);
    if (state) {
      throw new Error('Модуль уже установлен');
    }
    // Interrupted install: files on disk but missing _state.json entry.
    logger.warn({ moduleId }, 'Removing orphaned module directory before install');
    rmSync(moduleDir(moduleId), { recursive: true, force: true });
  }

  const registry = await loadRegistry();
  const entry = findRegistryEntry(moduleId, registry);
  if (!entry) {
    throw new Error('Модуль не найден в каталоге');
  }

  const branch = entry.defaultBranch || 'main';
  const dir = moduleDir(moduleId);

  logger.info({ moduleId, repo: entry.repository }, 'Installing module');
  cloneRepo(entry.repository, branch, dir);

  const manifest = readLocalManifest(moduleId);
  if (!manifest) {
    rmSync(dir, { recursive: true, force: true });
    throw new Error('wash-module.json не найден в репозитории');
  }

  checkDependencies(manifest);

  const dataDir = moduleDataDir(moduleId);
  mkdirSync(dataDir, { recursive: true });
  const settings = defaultSettings(manifest);
  writeModuleSettings(moduleId, settings);

  let pyorchScriptId: string | undefined;
  let status: InstalledModuleState['status'] = 'installed';

  if (await isPyorchAvailable()) {
    const code = readEntrypointCode(dir, manifest.entrypoint);
    const script = await registerModuleScript({
      moduleId,
      name: manifest.name.ru,
      description: manifest.description.ru,
      code,
      entrypoint: manifest.entrypoint.split('/').pop() || 'main.py',
      version: manifest.version,
      settings,
      dataDir,
    });
    pyorchScriptId = script.id;
    status = 'stopped';
  }

  const now = new Date().toISOString();
  return upsertInstalledState({
    id: moduleId,
    version: manifest.version,
    repository: entry.repository,
    installedAt: now,
    updatedAt: now,
    pyorchScriptId,
    status,
  });
}

export async function uninstallModule(moduleId: string): Promise<void> {
  const state = getInstalledState(moduleId);
  if (!state) {
    throw new Error('Модуль не установлен');
  }

  if (state.pyorchScriptId && (await isPyorchAvailable())) {
    await deleteModuleScript(state.pyorchScriptId);
  }

  rmSync(moduleDir(moduleId), { recursive: true, force: true });
  removeInstalledState(moduleId);
}

export async function startModule(moduleId: string): Promise<InstalledModuleState> {
  const state = getInstalledState(moduleId);
  if (!state) throw new Error('Модуль не установлен');
  if (!state.pyorchScriptId) {
    throw new Error('PyOrchestrator недоступен — перезапустите модуль после включения оркестратора');
  }

  await startModuleScript(state.pyorchScriptId);
  return upsertInstalledState({ ...state, status: 'running', lastError: undefined });
}

export async function stopModule(moduleId: string): Promise<InstalledModuleState> {
  const state = getInstalledState(moduleId);
  if (!state) throw new Error('Модуль не установлен');
  if (state.pyorchScriptId) {
    await stopModuleScript(state.pyorchScriptId);
  }
  return upsertInstalledState({ ...state, status: 'stopped' });
}

export async function updateModule(moduleId: string): Promise<InstalledModuleState> {
  const state = getInstalledState(moduleId);
  if (!state) throw new Error('Модуль не установлен');

  const wasRunning = state.status === 'running';
  if (wasRunning && state.pyorchScriptId) {
    await stopModuleScript(state.pyorchScriptId);
  }

  upsertInstalledState({ ...state, status: 'updating' });

  const registry = await loadRegistry();
  const entry = findRegistryEntry(moduleId, registry);
  if (!entry) throw new Error('Модуль не найден в каталоге');

  const branch = entry.defaultBranch || 'main';
  const dir = moduleDir(moduleId);
  const dataBackup = existsSync(moduleDataDir(moduleId))
    ? readFileSync(join(moduleDataDir(moduleId), 'settings.json'), 'utf8')
    : null;

  cloneRepo(entry.repository, branch, dir);

  if (dataBackup) {
    mkdirSync(moduleDataDir(moduleId), { recursive: true });
    writeFileSync(moduleSettingsPath(moduleId), dataBackup, 'utf8');
  }

  const manifest = readLocalManifest(moduleId);
  if (!manifest) throw new Error('wash-module.json не найден');

  const settings = readModuleSettings(moduleId);

  if (state.pyorchScriptId && (await isPyorchAvailable())) {
    const code = readEntrypointCode(dir, manifest.entrypoint);
    const script = await registerModuleScript({
      moduleId,
      name: manifest.name.ru,
      description: manifest.description.ru,
      code,
      entrypoint: manifest.entrypoint.split('/').pop() || 'main.py',
      version: manifest.version,
      settings,
      dataDir: moduleDataDir(moduleId),
    });
    state.pyorchScriptId = script.id;
  }

  const updated = upsertInstalledState({
    ...state,
    version: manifest.version,
    updatedAt: new Date().toISOString(),
    status: 'stopped',
  });

  if (wasRunning && updated.pyorchScriptId) {
    return startModule(moduleId);
  }
  return updated;
}

export async function saveModuleSettings(
  moduleId: string,
  settings: Record<string, unknown>
): Promise<InstalledModuleState> {
  const state = getInstalledState(moduleId);
  if (!state) throw new Error('Модуль не установлен');

  const existing = readModuleSettings(moduleId);
  const merged = mergeModuleSettings(existing, settings);

  writeModuleSettings(moduleId, merged);

  if (state.pyorchScriptId && (await isPyorchAvailable())) {
    await syncModuleSecrets(state.pyorchScriptId, merged, moduleDataDir(moduleId));
  }

  return state;
}

/** Re-register PyOrch scripts for all installed modules; restart those that were running. */
export async function recoverRunningModules(): Promise<Array<{ moduleId: string; ok: boolean; error?: string }>> {
  if (!(await isPyorchAvailable())) {
    throw new Error('PyOrchestrator недоступен');
  }

  const results: Array<{ moduleId: string; ok: boolean; error?: string }> = [];
  for (const state of listInstalledStates()) {
    if (!state.pyorchScriptId) continue;
    const wasRunning = state.status === 'running';
    try {
      await reregisterModule(state.id);
      if (wasRunning) {
        await startModule(state.id);
      }
      results.push({ moduleId: state.id, ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.warn({ moduleId: state.id, err: message }, 'Module recover failed');
      results.push({ moduleId: state.id, ok: false, error: message });
    }
  }
  return results;
}

export async function reregisterModule(moduleId: string): Promise<InstalledModuleState> {
  const state = getInstalledState(moduleId);
  if (!state) throw new Error('Модуль не установлен');
  if (!state.pyorchScriptId) {
    throw new Error('PyOrchestrator недоступен — перезапустите модуль после включения оркестратора');
  }

  const manifest = readLocalManifest(moduleId);
  if (!manifest) throw new Error('wash-module.json не найден');

  const settings = readModuleSettings(moduleId);
  const code = readEntrypointCode(moduleDir(moduleId), manifest.entrypoint);

  if (await isPyorchAvailable()) {
    await registerModuleScript({
      moduleId,
      name: manifest.name.ru,
      description: manifest.description.ru,
      code,
      entrypoint: manifest.entrypoint.split('/').pop() || 'main.py',
      version: manifest.version,
      settings,
      dataDir: moduleDataDir(moduleId),
    });
  }

  return upsertInstalledState({
    ...state,
    updatedAt: new Date().toISOString(),
  });
}

export function readModuleDataFile(moduleId: string, filename: string): unknown {
  const path = join(moduleDataDir(moduleId), filename);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return readFileSync(path, 'utf8');
  }
}

/** Snapshot for UI; synthesizes from settings/state when last_snapshot.json is missing. */
export function readModuleSnapshot(moduleId: string): unknown {
  const raw = readModuleDataFile(moduleId, 'last_snapshot.json');
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw;
  }

  if (moduleId !== 'dynamic-pricing') {
    return null;
  }

  const settings = readModuleSettings(moduleId) as Record<string, unknown>;
  const stateRaw = readModuleDataFile(moduleId, 'surge_state.json');
  const state =
    stateRaw && typeof stateRaw === 'object' && !Array.isArray(stateRaw)
      ? (stateRaw as Record<string, unknown>)
      : {};
  const washId = String(settings.wash_id ?? '').trim();
  const configError = washId
    ? undefined
    : 'wash_id is not configured — select a car wash in module settings';

  return {
    recordedAt: null,
    washId,
    totalPosts: 0,
    busyPosts: 0,
    busyThreshold: Number(settings.busy_threshold) || 1,
    surgeActive: Boolean(state.surgeActive),
    surgeCoefficient: 1.0,
    priceIncreasePercent: Number(settings.price_increase_percent) || 10,
    postsUpdatedLastCycle: 0,
    lastEvent: washId ? 'awaiting_run' : 'config_missing',
    recentEvents: Array.isArray(state.recentEvents) ? state.recentEvents : [],
    ...(configError ? { configError } : {}),
  };
}
