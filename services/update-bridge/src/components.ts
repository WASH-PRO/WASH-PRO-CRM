import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { UpdateComponentId } from './types.js';

const DEPLOY_ROOT = process.env.DEPLOY_ROOT || '/deploy';

export interface ComponentDef {
  id: UpdateComponentId;
  label: string;
  githubRepo: string;
  readCurrentVersion: () => string;
}

function readJsonVersion(path: string): string | null {
  try {
    if (!existsSync(path)) return null;
    const raw = readFileSync(path, 'utf8');
    const json = JSON.parse(raw) as { version?: string };
    return json.version?.trim() || null;
  } catch {
    return null;
  }
}

function readEnvFileVersion(path: string, key: string): string | null {
  try {
    if (!existsSync(path)) return null;
    const raw = readFileSync(path, 'utf8');
    const match = raw.match(new RegExp(`^${key}=(.+)$`, 'm'));
    return match?.[1]?.trim() || null;
  } catch {
    return null;
  }
}

function readDeployEnvVersion(key: string): string | null {
  return readEnvFileVersion(join(DEPLOY_ROOT, '.env'), key);
}

export const COMPONENTS: ComponentDef[] = [
  {
    id: 'crm',
    label: 'WASH-PRO-CRM',
    githubRepo: process.env.CRM_GITHUB_REPO || 'WASH-PRO/WASH-PRO-CRM',
    readCurrentVersion: () =>
      readDeployEnvVersion('APP_VERSION') ||
      readJsonVersion(join(DEPLOY_ROOT, 'dashboard/package.json')) ||
      '0.0.0',
  },
  {
    id: 'dynamic-api',
    label: 'Dynamic API',
    githubRepo: process.env.DYNAMIC_API_GITHUB_REPO || 'Dynamic-API-Platform/Dynamic-API-Platform',
    readCurrentVersion: () =>
      readDeployEnvVersion('DYNAMIC_API_VERSION') ||
      readJsonVersion(join(DEPLOY_ROOT, 'dynamic-api/backend/package.json')) ||
      '0.0.0',
  },
  {
    id: 'pyorchestrator',
    label: 'PyOrchestrator',
    githubRepo: process.env.PYORCHESTRATOR_GITHUB_REPO || 'PyOrchestrator/PyOrchestrator',
    readCurrentVersion: () =>
      readDeployEnvVersion('PYORCHESTRATOR_VERSION') ||
      readEnvFileVersion(join(DEPLOY_ROOT, 'pyorchestrator/.env.example'), 'APP_VERSION') ||
      '0.0.0',
  },
];

export function getComponent(id: UpdateComponentId): ComponentDef {
  const found = COMPONENTS.find((c) => c.id === id);
  if (!found) throw new Error(`Unknown component: ${id}`);
  return found;
}
