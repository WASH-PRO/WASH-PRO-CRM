import { join } from 'node:path';

export const MODULES_DIR = process.env.MODULES_DIR || '/modules';
export const DEPLOY_ROOT = process.env.DEPLOY_ROOT || '/deploy';
export const REGISTRY_PATH =
  process.env.MODULES_REGISTRY_PATH || join(DEPLOY_ROOT, 'modules/registry.json');
export const INSTALLED_DIR = join(MODULES_DIR, 'installed');
export const STATE_FILE = join(MODULES_DIR, 'installed', '_state.json');
export const ICONS_DIR = join(DEPLOY_ROOT, 'modules/icons');

export function moduleDir(moduleId: string): string {
  return join(INSTALLED_DIR, moduleId);
}

export function moduleDataDir(moduleId: string): string {
  return join(moduleDir(moduleId), 'data');
}

export function moduleManifestPath(moduleId: string): string {
  return join(moduleDir(moduleId), 'wash-module.json');
}

export function moduleSettingsPath(moduleId: string): string {
  return join(moduleDataDir(moduleId), 'settings.json');
}

export function moduleUiDir(moduleId: string): string {
  return join(moduleDir(moduleId), 'ui');
}

export function githubRawUrl(repo: string, branch: string, filePath: string): string {
  return `https://raw.githubusercontent.com/${repo}/${branch}/${filePath}`;
}
