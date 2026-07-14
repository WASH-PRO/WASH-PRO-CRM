import { randomUUID } from 'node:crypto';
import { fetchLatestRelease, parseTagVersion } from './github.js';
import { isNewerVersion } from './semver.js';
import { COMPONENTS, getComponent } from './components.js';
import { notifyCrm } from './notify.js';
import {
  addJob,
  clearDismissedFailedJob,
  dismissFailedJob,
  dismissVersion,
  getActiveJob,
  getCachedComponents,
  getDismissedFailedJobIds,
  getRecentJobs,
  getState,
  loadState,
  saveState,
  setLastCheck,
  updateJob,
} from './state.js';
import { createSteps, crmAppVersionSyncCommand, crmGitCheckoutVersionCommand, getStepCommand, isExecutorAvailable, runShell, usesCompose } from './executor.js';
import { composeCommandEnv } from './host-path.js';
import type { ComponentCheck, UpdateComponentId, UpdateJob, UpdatesStatus } from './types.js';

let running = false;
let pendingRun: { jobId: string; targetTag: string } | null = null;

function targetTagForJob(job: UpdateJob): string {
  return job.targetTag || `v${job.targetVersion}`;
}

/** Закрывает зависшие задачи: целевая версия уже установлена или очередь не стартовала. */
function reconcileActiveJob(components: ComponentCheck[]): boolean {
  const job = getActiveJob();
  if (!job) return false;

  const current =
    components.find((c) => c.id === job.component)?.currentVersion ??
    getComponent(job.component).readCurrentVersion();

  if (
    (job.status === 'queued' || job.status === 'running') &&
    !isNewerVersion(job.targetVersion, current)
  ) {
    job.status = 'completed';
    job.finishedAt = new Date().toISOString();
    job.logs.push(`INFO: v${current} already installed — closing stale job`);
    for (const step of job.steps) {
      if (step.status === 'pending' || step.status === 'running') {
        step.status = 'skipped';
        step.finishedAt = step.finishedAt ?? new Date().toISOString();
      }
    }
    updateJob(job);
    return true;
  }

  if (job.status === 'queued') {
    const ageMs = Date.now() - new Date(job.createdAt).getTime();
    const allPending = job.steps.every((s) => s.status === 'pending');
    if (allPending && ageMs > 60_000 && !running) {
      void runJob(job.id, targetTagForJob(job));
    } else if (allPending && ageMs > 10 * 60 * 1000) {
      job.status = 'failed';
      job.error = 'Обновление не запустилось (очередь зависла). Запустите снова из Настроек.';
      job.finishedAt = new Date().toISOString();
      for (const step of job.steps) {
        if (step.status === 'pending') {
          step.status = 'failed';
          step.message = 'Не запущено';
          step.finishedAt = new Date().toISOString();
        }
      }
      updateJob(job);
      return true;
    }
  }

  return false;
}

/** Failed job is stale when CRM already reached its target (e.g. manual pull or later successful update). */
function syncStaleFailedJobDismissals(components: ComponentCheck[]): boolean {
  const state = getState();
  let changed = false;
  for (const c of components) {
    const job = state.jobs.find((j) => j.component === c.id);
    if (job?.status !== 'failed') continue;
    if (state.dismissedFailedJobIds[c.id] === job.id) continue;
    if (!isNewerVersion(job.targetVersion, c.currentVersion)) {
      dismissFailedJob(c.id, job.id);
      changed = true;
    }
  }
  return changed;
}

export async function checkComponent(id: UpdateComponentId): Promise<ComponentCheck> {
  const def = getComponent(id);
  const currentVersion = def.readCurrentVersion();
  let latest = null as Awaited<ReturnType<typeof fetchLatestRelease>>;
  let error: string | null = null;
  try {
    latest = await fetchLatestRelease(def.githubRepo);
  } catch (err) {
    latest = null;
    error = err instanceof Error ? err.message : 'Не удалось получить релизы GitHub';
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
    error,
  };
}

export async function checkAllComponents(): Promise<ComponentCheck[]> {
  const previous = getCachedComponents();
  const results = await Promise.all(
    COMPONENTS.map(async (def) => {
      const check = await checkComponent(def.id);
      if (check.error && !check.latestVersion) {
        const prev = previous.find((p) => p.id === def.id);
        if (prev?.latestVersion) {
          const currentVersion = check.currentVersion;
          return {
            ...check,
            latestVersion: prev.latestVersion,
            latestTag: prev.latestTag,
            updateAvailable: isNewerVersion(prev.latestVersion, currentVersion),
            releaseUrl: prev.releaseUrl ?? check.releaseUrl,
            releaseNotes: prev.releaseNotes ?? check.releaseNotes,
            publishedAt: prev.publishedAt ?? check.publishedAt,
            error: check.error,
          };
        }
      }
      return check;
    })
  );
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
  if (syncStaleFailedJobDismissals(components)) {
    void saveState();
  }
  if (reconcileActiveJob(components)) {
    void saveState();
  }
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
    dismissedFailedJobIds: getDismissedFailedJobIds(),
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

export async function dismissComponentUpdate(
  component: UpdateComponentId,
  version: string,
  failedJobId?: string
): Promise<void> {
  await loadState();
  dismissVersion(component, version);
  if (failedJobId) dismissFailedJob(component, failedJobId);
  await saveState();
}

export async function startUpdate(componentId: UpdateComponentId, targetTag?: string): Promise<UpdateJob> {
  const executor = isExecutorAvailable();
  if (!executor.ok) throw new Error(executor.reason || 'Executor unavailable');

  await loadState();
  const cached = getCachedComponents();
  if (cached.length && reconcileActiveJob(withLiveVersions(cached))) {
    await saveState();
  }
  if (getActiveJob()) throw new Error('Уже выполняется другое обновление');

  const def = getComponent(componentId);
  const check = await checkComponent(componentId);
  const tag = targetTag || check.latestTag;
  if (!tag) throw new Error('Нет доступного релиза на GitHub');

  const job: UpdateJob = {
    id: randomUUID(),
    component: componentId,
    targetVersion: parseTagVersion(tag),
    targetTag: tag,
    fromVersion: check.currentVersion,
    status: 'queued',
    steps: createSteps(componentId),
    logs: [],
    createdAt: new Date().toISOString(),
  };

  addJob(job);
  clearDismissedFailedJob(componentId);
  await saveState();
  void runJob(job.id, tag);
  return job;
}

async function runJob(jobId: string, targetTag: string): Promise<void> {
  if (running) {
    pendingRun = { jobId, targetTag };
    return;
  }
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

  const componentLabel = getComponent(job.component).label;
  void notifyCrm(
    'software_update_started',
    `Запущено обновление ${componentLabel}: v${job.fromVersion} → v${job.targetVersion}`,
    'info'
  );

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
        const composeEnv = usesCompose(step.id) ? composeCommandEnv() : undefined;
        const env =
          composeEnv && job.component === 'crm' && step.id === 'build'
            ? { ...composeEnv, APP_VERSION: job.targetVersion, VITE_APP_VERSION: job.targetVersion }
            : composeEnv;
        if (env) {
          appendLog(`DATA_DIR=${env.DATA_DIR}`);
          appendLog(`WASH_HOST_PROJECT_ROOT=${env.WASH_HOST_PROJECT_ROOT}`);
          if ('APP_VERSION' in env && env.APP_VERSION) {
            appendLog(`APP_VERSION=${env.APP_VERSION} (build only, .env unchanged until success)`);
          }
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
    if (job.component === 'crm') {
      const versionCmd = crmAppVersionSyncCommand(job.targetVersion);
      appendLog(`$ ${versionCmd}`);
      await runShell(versionCmd, appendLog);
    }
    await checkAllComponents();
    void notifyCrm(
      'software_update_success',
      `Обновление ${componentLabel} завершено: v${job.targetVersion}`,
      'info'
    );
  } catch (err) {
    job.status = 'failed';
    job.error = err instanceof Error ? err.message : 'Update failed';
    job.finishedAt = new Date().toISOString();
    appendLog(`ERROR: ${job.error}`);
    void notifyCrm(
      'software_update_failed',
      `Ошибка обновления ${componentLabel} (v${job.targetVersion}): ${job.error}`,
      'error'
    );
    if (job.component === 'crm' && job.fromVersion !== job.targetVersion) {
      const pullDone = job.steps.find((s) => s.id === 'pull')?.status === 'completed';
      const buildDone = job.steps.find((s) => s.id === 'build')?.status === 'completed';
      if (buildDone) {
        // Сборка прошла — оставляем новую версию; seed/health могут упасть без отката.
        try {
          appendLog(`$ ${crmAppVersionSyncCommand(job.targetVersion)}`);
          await runShell(crmAppVersionSyncCommand(job.targetVersion), appendLog);
        } catch (revertErr) {
          const msg = revertErr instanceof Error ? revertErr.message : 'APP_VERSION sync failed';
          appendLog(`WARN: ${msg}`);
        }
      } else if (pullDone) {
        try {
          const checkoutCmd = crmGitCheckoutVersionCommand(job.fromVersion);
          appendLog(`$ ${checkoutCmd}`);
          await runShell(checkoutCmd, appendLog);
        } catch (revertErr) {
          const msg = revertErr instanceof Error ? revertErr.message : 'Git checkout failed';
          appendLog(`WARN: ${msg}`);
        }
        try {
          appendLog(`$ ${crmAppVersionSyncCommand(job.fromVersion)}`);
          await runShell(crmAppVersionSyncCommand(job.fromVersion), appendLog);
        } catch (revertErr) {
          const msg = revertErr instanceof Error ? revertErr.message : 'Revert APP_VERSION failed';
          appendLog(`WARN: ${msg}`);
        }
      }
    }
  }

  updateJob(job);
  await saveState();
  running = false;
  if (pendingRun) {
    const next = pendingRun;
    pendingRun = null;
    void runJob(next.jobId, next.targetTag);
  }
}

export function scheduleBackgroundChecks(intervalMs = 6 * 60 * 60 * 1000): void {
  const tick = () => {
    void checkAllComponents().catch(() => {});
  };
  setTimeout(tick, 30_000);
  setInterval(tick, intervalMs);
}
