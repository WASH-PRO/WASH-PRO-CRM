import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ComponentCheck, PersistedState, UpdateJob } from './types.js';

const STATE_DIR = process.env.STATE_DIR || '/data';
const STATE_FILE = join(STATE_DIR, 'state.json');

const DEFAULT_STATE: PersistedState = {
  lastCheckAt: null,
  lastComponents: [],
  dismissedVersions: {},
  dismissedFailedJobIds: {},
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

export function dismissFailedJob(component: string, jobId: string): void {
  cache.dismissedFailedJobIds[component] = jobId;
}

export function clearDismissedFailedJob(component: string): void {
  delete cache.dismissedFailedJobIds[component];
}

export function getDismissedFailedJobIds(): Record<string, string> {
  return { ...cache.dismissedFailedJobIds };
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

/**
 * При старте процесса помечает незавершённые задачи как прерванные.
 * Задача выполняется в памяти (runJob) и не возобновляется после рестарта,
 * поэтому оставшийся в состоянии `running`/`queued` job навсегда блокирует
 * UI («зависло на шаге») и запуск новых обновлений. Возвращает true, если
 * что-то было сброшено (нужно сохранить состояние).
 */
export function recoverInterruptedJobs(): boolean {
  let changed = false;
  for (const job of cache.jobs) {
    if (job.status === 'running' || job.status === 'queued') {
      job.status = 'failed';
      job.error = 'Обновление прервано (перезапуск сервиса). Запустите заново.';
      job.finishedAt = new Date().toISOString();
      for (const step of job.steps) {
        if (step.status === 'running' || step.status === 'pending') {
          step.status = step.status === 'running' ? 'failed' : 'skipped';
          if (step.status === 'failed') step.message = 'Прервано перезапуском';
          step.finishedAt = step.finishedAt ?? new Date().toISOString();
        }
      }
      changed = true;
    }
  }
  if (cache.activeJobId) {
    cache.activeJobId = null;
    changed = true;
  }
  return changed;
}

export function getRecentJobs(limit = 10): UpdateJob[] {
  return cache.jobs.slice(0, limit);
}
