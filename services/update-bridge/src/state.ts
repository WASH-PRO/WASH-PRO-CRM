import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ComponentCheck, PersistedState, UpdateJob } from './types.js';

const STATE_DIR = process.env.STATE_DIR || '/data';
const STATE_FILE = join(STATE_DIR, 'state.json');

const DEFAULT_STATE: PersistedState = {
  lastCheckAt: null,
  lastComponents: [],
  dismissedVersions: {},
  jobs: [],
  activeJobId: null,
};

let cache: PersistedState = { ...DEFAULT_STATE };

export async function loadState(): Promise<PersistedState> {
  try {
    const raw = await readFile(STATE_FILE, 'utf8');
    cache = { ...DEFAULT_STATE, ...(JSON.parse(raw) as PersistedState) };
  } catch {
    cache = { ...DEFAULT_STATE };
  }
  return cache;
}

export async function saveState(): Promise<void> {
  await mkdir(STATE_DIR, { recursive: true });
  await writeFile(STATE_FILE, JSON.stringify(cache, null, 2), 'utf8');
}

export function getState(): PersistedState {
  return cache;
}

export function setLastCheck(components: ComponentCheck[]): void {
  cache.lastCheckAt = new Date().toISOString();
  cache.lastComponents = components;
}

export function getCachedComponents(): ComponentCheck[] {
  return cache.lastComponents;
}

export function dismissVersion(component: string, version: string): void {
  cache.dismissedVersions[component] = version;
}

export function addJob(job: UpdateJob): void {
  cache.jobs.unshift(job);
  cache.jobs = cache.jobs.slice(0, 30);
  cache.activeJobId = job.id;
}

export function updateJob(job: UpdateJob): void {
  const idx = cache.jobs.findIndex((j) => j.id === job.id);
  if (idx >= 0) cache.jobs[idx] = job;
  if (cache.activeJobId === job.id && (job.status === 'completed' || job.status === 'failed')) {
    cache.activeJobId = null;
  }
}

export function getActiveJob(): UpdateJob | null {
  if (!cache.activeJobId) return null;
  return cache.jobs.find((j) => j.id === cache.activeJobId) ?? null;
}

export function getRecentJobs(limit = 10): UpdateJob[] {
  return cache.jobs.slice(0, limit);
}
