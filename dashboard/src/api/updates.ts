import { fetchWithAuth } from './client';
import { tGlobal } from '../i18n/runtime';

export type UpdateComponentId = 'crm' | 'dynamic-api' | 'pyorchestrator';

export type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export type JobStatus = 'queued' | 'running' | 'completed' | 'failed';

export interface UpdateStep {
  id: string;
  label: string;
  status: StepStatus;
  message?: string;
  startedAt?: string;
  finishedAt?: string;
}

export interface UpdateJob {
  id: string;
  component: UpdateComponentId;
  targetVersion: string;
  fromVersion: string;
  status: JobStatus;
  steps: UpdateStep[];
  logs: string[];
  error?: string;
  createdAt: string;
  finishedAt?: string;
}

export interface ComponentCheck {
  id: UpdateComponentId;
  label: string;
  githubRepo: string;
  currentVersion: string;
  latestVersion: string | null;
  latestTag: string | null;
  updateAvailable: boolean;
  releaseUrl: string | null;
  releaseNotes: string | null;
  publishedAt: string | null;
  checkedAt: string | null;
}

export interface UpdatesStatus {
  executorAvailable: boolean;
  executorReason: string | null;
  lastCheckAt: string | null;
  components: ComponentCheck[];
  activeJob: UpdateJob | null;
  recentJobs: UpdateJob[];
  showNotification: boolean;
}

async function parseJson<T>(res: Response): Promise<T> {
  const json = (await res.json()) as { success?: boolean; error?: string; data?: T };
  if (!res.ok || json.success === false) {
    throw new Error(json.error || res.statusText || tGlobal('errors.requestFailed', { status: res.status }));
  }
  return json.data as T;
}

export async function getUpdatesStatus(refresh = false): Promise<UpdatesStatus> {
  const q = refresh ? '?refresh=1' : '';
  const res = await fetchWithAuth(`/api/crm/updates/status${q}`);
  return parseJson(res);
}

export async function checkForUpdates(): Promise<ComponentCheck[]> {
  const res = await fetchWithAuth('/api/crm/updates/check', { method: 'POST' });
  const data = await parseJson<{ components: ComponentCheck[] }>(res);
  return data.components;
}

export async function applyUpdate(component: UpdateComponentId, targetTag?: string): Promise<UpdateJob> {
  const res = await fetchWithAuth(`/api/crm/updates/apply/${component}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetTag }),
  });
  return parseJson(res);
}

export async function dismissUpdate(component: UpdateComponentId, version: string): Promise<void> {
  const res = await fetchWithAuth(`/api/crm/updates/dismiss/${component}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ version }),
  });
  await parseJson(res);
}

export function componentById(status: UpdatesStatus | null, id: UpdateComponentId): ComponentCheck | undefined {
  return status?.components.find((c) => c.id === id);
}
