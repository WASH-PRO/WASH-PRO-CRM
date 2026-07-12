import { existsSync, readFileSync } from 'node:fs';
import type { WashModuleManifest } from './types.js';
import { moduleManifestPath } from './paths.js';

export function isModuleInstalled(moduleId: string): boolean {
  return existsSync(moduleManifestPath(moduleId));
}

export function readLocalManifest(moduleId: string): WashModuleManifest | null {
  const path = moduleManifestPath(moduleId);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as WashModuleManifest;
  } catch {
    return null;
  }
}
