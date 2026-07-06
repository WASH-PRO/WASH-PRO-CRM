import { randomUUID } from 'node:crypto';
import { fetchLatestRelease, parseTagVersion } from './github.js';
import { isNewerVersion } from './semver.js';
import { COMPONENTS, getComponent } from './components.js';
import {
  addJob,
  dismissVersion,
  getActiveJob,
  getCachedComponents,
  getRecentJobs,
  getState,
  loadState,
  saveState,
  setLastCheck,
  updateJob,
} from './state.js';
import { createSteps, getStepCommand, isExecutorAvailable, runShell, usesCompose } from './executor.js';
import { composeCommandEnv } from './host-path.js';
import type { ComponentCheck, UpdateComponentId, UpdateJob, UpdatesStatus } from './types.js';

let running = false;

export async function checkComponent(id: UpdateComponentId): Promise<ComponentCheck> {
  const def = getComponent(id);
  const currentVersion = def.readCurrentVersion();
  let latest = null as Awaited<ReturnType<typeof fetchLatestRelease>>;
  try {
    latest = await fetchLatestRelease(def.githubRepo);
  } catch {
    latest = null;
  }
  const latestVersion = latest ? parseTagVersion(latest.tag_name) : null;
  const updateAvailable = latestVersion ? isNewerVersion(latestVersion, currentVersion) : false;

  return {
    id: def.id,
    label: def.label,
    githubRepo: def.githubRepo,
    currentVersion,
    latestVersion,
    latestTag: latest?.tag_name ?? null,
    updateAvailable,
    releaseUrl: latest?.html_url ?? null,
    releaseNotes: latest?.body ?? null,
    publishedAt: latest?.published_at ?? null,
    checkedAt: new Date().toISOString(),
  };
}

export async function checkAllComponents(): Promise<ComponentCheck[]> {
  const results = await Promise.all(COMPONENTS.map((c) => checkComponent(c.id)));
  setLastCheck(results);
  await saveState();
  return results;
}

function withLiveVersions(cached: ComponentCheck[]): ComponentCheck[] {
  return cached.map((c) => {
    const currentVersion = getComponent(c.id).readCurrentVersion();
    const updateAvailable = c.latestVersion ? isNewerVersion(c.latestVersion, currentVersion) : false;
    return { ...c, currentVersion, updateAvailable };
  });
}

export function buildStatus(components: ComponentCheck[]): UpdatesStatus {
  const state = getState();
  const executor = isExecutorAvailable();
  const activeJob = getActiveJob();
  const showNotification = components.some((c) => {
    if (!c.updateAvailable || !c.latestVersion) return false;
    return state.dismissedVersions[c.id] !== c.latestVersion;
  });

  return {
    executorAvailable: executor.ok,
    executorReason: executor.reason,
    lastCheckAt: state.lastCheckAt,
    components,
    activeJob,
    recentJobs: getRecentJobs(8),
    showNotification,
  };
}

export async function getUpdatesStatus(refresh = false): Promise<UpdatesStatus> {
  await loadState();
  if (refresh || !getState().lastCheckAt) {
    const components = await checkAllComponents();
    return buildStatus(components);
  }
  const cached = getCachedComponents();
  if (cached.length) {
    return buildStatus(withLiveVersions(cached));
  }
  const components = await checkAllComponents();
  return buildStatus(components);
}

export async function dismissComponentUpdate(component: UpdateComponentId, version: string): Promise<void> {
  await loadState();
  dismissVersion(component, version);
  await saveState();
}

export async function startUpdate(componentId: UpdateComponentId, targetTag?: string): Promise<UpdateJob> {
  const executor = isExecutorAvailable();
  if (!executor.ok) throw new Error(executor.reason || 'Executor unavailable');

  await loadState();
  if (getActiveJob()) throw new Error('Уже выполняется другое обновление');

  const def = getComponent(componentId);
  const check = await checkComponent(componentId);
  const tag = targetTag || check.latestTag;
  if (!tag) throw new Error('Нет доступного релиза на GitHub');

  const job: UpdateJob = {
    id: randomUUID(),
    component: componentId,
    targetVersion: parseTagVersion(tag),
    fromVersion: check.currentVersion,
    status: 'queued',
    steps: createSteps(componentId),
    logs: [],
    createdAt: new Date().toISOString(),
  };

  addJob(job);
  await saveState();
  void runJob(job.id, tag);
  return job;
}

async function runJob(jobId: string, targetTag: string): Promise<void> {
  if (running) return;
  running = true;
  await loadState();
  const job = getActiveJob();
  if (!job || job.id !== jobId) {
    running = false;
    return;
  }

  job.status = 'running';
  updateJob(job);
  await saveState();

  const appendLog = (line: string) => {
    job.logs.push(line);
    if (job.logs.length > 500) job.logs.shift();
  };

  try {
    for (const step of job.steps) {
      step.status = 'running';
      step.startedAt = new Date().toISOString();
      updateJob(job);
      await saveState();

      const cmd = getStepCommand(job.component, step.id, targetTag);
      appendLog(`$ ${cmd}`);
      try {
        const env = usesCompose(step.id) ? composeCommandEnv() : undefined;
        if (env) {
          appendLog(`DATA_DIR=${env.DATA_DIR}`);
        }
        await runShell(cmd, appendLog, env);
        step.status = 'completed';
        step.message = 'Готово';
      } catch (err) {
        step.status = 'failed';
        step.message = err instanceof Error ? err.message : 'Ошибка';
        throw err;
      } finally {
        step.finishedAt = new Date().toISOString();
        updateJob(job);
        await saveState();
      }
    }

    job.status = 'completed';
    job.finishedAt = new Date().toISOString();
    await checkAllComponents();
  } catch (err) {
    job.status = 'failed';
    job.error = err instanceof Error ? err.message : 'Update failed';
    job.finishedAt = new Date().toISOString();
    appendLog(`ERROR: ${job.error}`);
  }

  updateJob(job);
  await saveState();
  running = false;
}

export function scheduleBackgroundChecks(intervalMs = 6 * 60 * 60 * 1000): void {
  const tick = () => {
    void checkAllComponents().catch(() => {});
  };
  setTimeout(tick, 30_000);
  setInterval(tick, intervalMs);
}
