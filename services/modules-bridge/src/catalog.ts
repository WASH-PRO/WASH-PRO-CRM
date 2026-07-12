import { readFileSync, existsSync } from 'node:fs';
import fetch from 'node-fetch';
import type { CatalogModule, ModuleRegistry, RegistryEntry, WashModuleManifest } from './types.js';
import { listInstalledStates } from './state.js';
import { REGISTRY_PATH, githubRawUrl } from './paths.js';
import { readLocalManifest, isModuleInstalled } from './manifest.js';
import { getModuleRunStatus } from './pyorch.js';
import { moduleIconPublicUrl } from './moduleIcons.js';

let registryCache: ModuleRegistry | null = null;
let registryFetchedAt = 0;
const REGISTRY_TTL_MS = 5 * 60 * 1000;

function readBundledRegistry(): ModuleRegistry {
  if (!existsSync(REGISTRY_PATH)) {
    return { version: 1, modules: [] };
  }
  const raw = readFileSync(REGISTRY_PATH, 'utf8');
  return JSON.parse(raw) as ModuleRegistry;
}

async function fetchRemoteRegistry(url: string): Promise<ModuleRegistry | null> {
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    return (await res.json()) as ModuleRegistry;
  } catch {
    return null;
  }
}

export async function loadRegistry(refresh = false): Promise<ModuleRegistry> {
  const now = Date.now();
  if (!refresh && registryCache && now - registryFetchedAt < REGISTRY_TTL_MS) {
    return registryCache;
  }

  let registry = readBundledRegistry();
  if (refresh && registry.catalogUrl) {
    const remote = await fetchRemoteRegistry(registry.catalogUrl);
    if (remote?.modules?.length) {
      registry = remote;
    }
  } else if (refresh && !registry.catalogUrl) {
    const remote = await fetchRemoteRegistry(
      'https://raw.githubusercontent.com/WASH-PRO/WASH-PRO-CRM/main/modules/registry.json'
    );
    if (remote?.modules?.length) {
      registry = remote;
    }
  }

  registryCache = registry;
  registryFetchedAt = now;
  return registry;
}

export async function fetchManifestFromRepo(entry: RegistryEntry): Promise<WashModuleManifest | null> {
  const branch = entry.defaultBranch || 'main';
  const url = githubRawUrl(entry.repository, branch, 'wash-module.json');
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const manifest = (await res.json()) as WashModuleManifest;
    if (manifest.id !== entry.id) {
      manifest.id = entry.id;
    }
    return manifest;
  } catch {
    return null;
  }
}

function resolveIconUrl(entry: RegistryEntry): string {
  return moduleIconPublicUrl(entry.id);
}

export async function buildCatalog(refresh = false): Promise<CatalogModule[]> {
  const registry = await loadRegistry(refresh);
  const installed = listInstalledStates();
  const installedById = new Map(installed.map((m) => [m.id, m]));

  const results: CatalogModule[] = [];

  for (const entry of registry.modules) {
    let manifest: WashModuleManifest | null = null;

    if (isModuleInstalled(entry.id)) {
      manifest = readLocalManifest(entry.id);
    }
    if (!manifest) {
      manifest = await fetchManifestFromRepo(entry);
    }
    if (!manifest && entry.manifest) {
      manifest = entry.manifest;
    }
    if (!manifest) continue;

    const state = installedById.get(entry.id);
    let activeRunStatus: string | null = null;
    if (state?.pyorchScriptId) {
      activeRunStatus = await getModuleRunStatus(state.pyorchScriptId);
    }

    results.push({
      ...manifest,
      installed: Boolean(state),
      installedVersion: state?.version,
      installState: state?.status,
      activeRunStatus,
      iconUrl: resolveIconUrl(entry),
    });
  }

  return results;
}

export function findRegistryEntry(moduleId: string, registry?: ModuleRegistry): RegistryEntry | null {
  const reg = registry ?? registryCache ?? readBundledRegistry();
  return reg.modules.find((m) => m.id === moduleId) ?? null;
}
