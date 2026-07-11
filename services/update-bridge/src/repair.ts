import { existsSync, readFileSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { composeCommandEnv, detectHostProjectRoot, resolveHostDataDir, resolveHostProjectRoot } from './host-path.js';
import { isExecutorAvailable, runShell } from './executor.js';
import { getActiveJob, recoverInterruptedJobs, saveState } from './state.js';

const DEPLOY_ROOT = (process.env.DEPLOY_ROOT || '/deploy').replace(/\/+$/, '') || '/deploy';
const ENV_FILE = join(DEPLOY_ROOT, '.env');

const CRITICAL_FILES = [
  'docker-compose.yml',
  'scripts/update-dynamic-api.sh',
  'scripts/update-pyorchestrator.sh',
  'scripts/fix-mqtt.sh',
  'scripts/start.sh',
];

const CRITICAL_DIRS = ['dashboard', 'dynamic-api', 'config/mosquitto', 'services/update-bridge'];

export type RepairIssueSeverity = 'ok' | 'warning' | 'error';

export interface RepairIssue {
  code: string;
  severity: RepairIssueSeverity;
  detail?: string;
  fixId?: string;
}

export interface RepairPaths {
  deployRoot: string;
  hostProjectRoot: string;
  detectedHostRoot: string | null;
  hostDataDir: string;
  envFile: string;
  envWashHostRoot: string | null;
  envDataDir: string | null;
}

export interface RepairDiagnoseResult {
  checkedAt: string;
  paths: RepairPaths;
  issues: RepairIssue[];
  healthy: boolean;
}

export interface RepairApplyResult {
  applied: string[];
  failed: Array<{ action: string; error: string }>;
  logs: string[];
  diagnose: RepairDiagnoseResult;
}

export const REPAIR_ACTIONS = [
  'sync_host_root_env',
  'normalize_data_dir',
  'git_safe_directory',
  'clear_stuck_job',
  'mosquitto_repair',
  'init_seed',
] as const;

export type RepairActionId = (typeof REPAIR_ACTIONS)[number];

function readDeployEnvKey(key: string): string | null {
  try {
    if (!existsSync(ENV_FILE)) return null;
    const content = readFileSync(ENV_FILE, 'utf8');
    const match = content.match(new RegExp(`^${key}=(.+)$`, 'm'));
    return match?.[1]?.trim() || null;
  } catch {
    return null;
  }
}

async function upsertEnvKey(key: string, value: string): Promise<void> {
  let content = '';
  try {
    content = await readFile(ENV_FILE, 'utf8');
  } catch {
    content = '';
  }
  const line = `${key}=${value}`;
  const re = new RegExp(`^${key}=.*$`, 'm');
  if (re.test(content)) {
    content = content.replace(re, line);
  } else if (content.length > 0 && !content.endsWith('\n')) {
    content += `\n${line}\n`;
  } else {
    content += `${line}\n`;
  }
  await writeFile(ENV_FILE, content, 'utf8');
}

function normalizePath(value: string): string {
  return value.replace(/\/+$/, '');
}

export async function diagnoseRepair(): Promise<RepairDiagnoseResult> {
  const detectedHostRoot = detectHostProjectRoot();
  const hostProjectRoot = resolveHostProjectRoot();
  const hostDataDir = resolveHostDataDir();
  const envWashHostRoot = readDeployEnvKey('WASH_HOST_PROJECT_ROOT');
  const envDataDir = readDeployEnvKey('DATA_DIR');
  const issues: RepairIssue[] = [];

  if (!existsSync(DEPLOY_ROOT)) {
    issues.push({ code: 'deploy_root_missing', severity: 'error', detail: DEPLOY_ROOT });
  }

  if (!detectedHostRoot) {
    issues.push({
      code: 'host_root_undetected',
      severity: 'warning',
      detail: DEPLOY_ROOT,
      fixId: 'sync_host_root_env',
    });
  }

  if (!existsSync(ENV_FILE)) {
    issues.push({
      code: 'env_missing',
      severity: 'error',
      detail: ENV_FILE,
      fixId: detectedHostRoot ? 'sync_host_root_env' : undefined,
    });
  } else {
    if (!envWashHostRoot) {
      issues.push({
        code: 'host_root_env_missing',
        severity: 'warning',
        fixId: detectedHostRoot ? 'sync_host_root_env' : undefined,
      });
    } else if (detectedHostRoot && normalizePath(envWashHostRoot) !== normalizePath(detectedHostRoot)) {
      issues.push({
        code: 'host_root_env_mismatch',
        severity: 'error',
        detail: `${envWashHostRoot} → ${detectedHostRoot}`,
        fixId: 'sync_host_root_env',
      });
    }

    // Absolute DATA_DIR on the host (/mnt/hdd/data, /var/lib/wash-pro-crm, …) is valid for production.
    // Only warn if it mistakenly points inside the container deploy bind mount (/deploy).
    if (envDataDir && envDataDir.startsWith('/')) {
      const normalized = normalizePath(envDataDir);
      if (normalized === DEPLOY_ROOT || normalized.startsWith(`${DEPLOY_ROOT}/`)) {
        issues.push({
          code: 'data_dir_suspicious',
          severity: 'warning',
          detail: envDataDir,
          fixId: 'normalize_data_dir',
        });
      }
    }
  }

  for (const rel of CRITICAL_FILES) {
    const full = join(DEPLOY_ROOT, rel);
    if (!existsSync(full)) {
      issues.push({ code: 'file_missing', severity: 'error', detail: rel });
    }
  }

  for (const rel of CRITICAL_DIRS) {
    const full = join(DEPLOY_ROOT, rel);
    if (!existsSync(full)) {
      issues.push({ code: 'dir_missing', severity: 'error', detail: rel });
    }
  }

  if (!existsSync('/var/run/docker.sock')) {
    issues.push({ code: 'docker_sock_missing', severity: 'error' });
  }

  try {
    await runShell(`git -C ${DEPLOY_ROOT} rev-parse --is-inside-work-tree`, () => {});
  } catch {
    issues.push({ code: 'git_not_repo', severity: 'warning', fixId: 'git_safe_directory' });
  }

  try {
    await runShell('docker compose config --quiet', () => {}, composeCommandEnv());
  } catch (err) {
    const message = err instanceof Error ? err.message : 'compose config failed';
    issues.push({ code: 'compose_config_invalid', severity: 'error', detail: message });
  }

  const executor = isExecutorAvailable();
  if (!executor.ok) {
    issues.push({
      code: 'executor_disabled',
      severity: 'warning',
      detail: executor.reason ?? undefined,
    });
  }

  const activeJob = getActiveJob();
  if (activeJob && (activeJob.status === 'running' || activeJob.status === 'queued')) {
    issues.push({
      code: 'stuck_update_job',
      severity: 'warning',
      detail: `${activeJob.component} (${activeJob.status})`,
      fixId: 'clear_stuck_job',
    });
  }

  const unhealthy = issues.some((i) => i.severity === 'error' || i.severity === 'warning');
  if (!unhealthy) {
    issues.push({ code: 'all_ok', severity: 'ok' });
  }

  return {
    checkedAt: new Date().toISOString(),
    paths: {
      deployRoot: DEPLOY_ROOT,
      hostProjectRoot,
      detectedHostRoot,
      hostDataDir,
      envFile: ENV_FILE,
      envWashHostRoot,
      envDataDir,
    },
    issues,
    healthy: !unhealthy,
  };
}

async function applyAction(action: RepairActionId, onLog: (line: string) => void): Promise<void> {
  const detected = detectHostProjectRoot() ?? resolveHostProjectRoot();

  switch (action) {
    case 'sync_host_root_env':
      await upsertEnvKey('WASH_HOST_PROJECT_ROOT', detected);
      onLog(`WASH_HOST_PROJECT_ROOT=${detected}`);
      return;

    case 'normalize_data_dir':
      await upsertEnvKey('DATA_DIR', './data');
      onLog('DATA_DIR=./data');
      return;

    case 'git_safe_directory':
      await runShell(
        `git config --global --add safe.directory ${DEPLOY_ROOT} && git -C ${DEPLOY_ROOT} rev-parse --is-inside-work-tree`,
        onLog
      );
      return;

    case 'clear_stuck_job':
      if (recoverInterruptedJobs()) {
        await saveState();
        onLog('Зависшее обновление сброшено');
      } else {
        onLog('Активных зависших обновлений не найдено');
      }
      return;

    case 'mosquitto_repair':
      await runShell(
        `cd ${DEPLOY_ROOT} && docker compose run --rm mosquitto-init && docker compose restart mosquitto message-processor`,
        onLog,
        composeCommandEnv()
      );
      return;

    case 'init_seed':
      await runShell(`cd ${DEPLOY_ROOT} && docker compose run --rm init-seed`, onLog, composeCommandEnv());
      return;

    default:
      throw new Error(`Unknown repair action: ${action}`);
  }
}

export async function applyRepair(actions: string[]): Promise<RepairApplyResult> {
  const valid = actions.filter((a): a is RepairActionId =>
    (REPAIR_ACTIONS as readonly string[]).includes(a)
  );
  const applied: string[] = [];
  const failed: Array<{ action: string; error: string }> = [];
  const logs: string[] = [];

  for (const action of valid) {
    logs.push(`--- ${action} ---`);
    try {
      await applyAction(action, (line) => logs.push(line));
      applied.push(action);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Repair failed';
      failed.push({ action, error: message });
      logs.push(`ERROR: ${message}`);
    }
  }

  const diagnose = await diagnoseRepair();
  return { applied, failed, logs, diagnose };
}
