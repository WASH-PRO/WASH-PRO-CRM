import { spawn } from 'node:child_process';
import { parseTagVersion } from './github.js';
import type { UpdateComponentId, UpdateStep } from './types.js';

const DEPLOY_ROOT = process.env.DEPLOY_ROOT || '/deploy';

export function isExecutorAvailable(): { ok: boolean; reason: string | null } {
  const enabled = process.env.UPDATE_EXECUTOR_ENABLED !== 'false';
  if (!enabled) {
    return { ok: false, reason: 'Автообновление отключено (UPDATE_EXECUTOR_ENABLED=false)' };
  }
  return { ok: true, reason: null };
}

const STEP_DEFS: Record<UpdateComponentId, Array<{ id: string; label: string }>> = {
  crm: [
    { id: 'pull', label: 'Загрузка из GitHub' },
    { id: 'build', label: 'Сборка и перезапуск CRM' },
    { id: 'seed', label: 'Синхронизация CRM (init-seed)' },
    { id: 'health', label: 'Проверка доступности' },
  ],
  'dynamic-api': [
    { id: 'fetch', label: 'Загрузка Dynamic API' },
    { id: 'build', label: 'Сборка и перезапуск' },
    { id: 'seed', label: 'Синхронизация CRM endpoints' },
    { id: 'health', label: 'Проверка API' },
  ],
  pyorchestrator: [
    { id: 'fetch', label: 'Загрузка PyOrchestrator' },
    { id: 'build', label: 'Сборка и перезапуск' },
    { id: 'health', label: 'Проверка сервиса' },
  ],
};

export function createSteps(component: UpdateComponentId): UpdateStep[] {
  return STEP_DEFS[component].map((s) => ({ ...s, status: 'pending' }));
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function envVersionSyncCommand(envFile: string, key: string, version: string): string {
  const file = shellQuote(envFile);
  const ver = shellQuote(version);
  return `if [ -f ${file} ]; then sed -i '/^${key}=/d' ${file}; printf '${key}=${ver}\\n' >> ${file}; else printf '${key}=${ver}\\n' > ${file}; fi`;
}

export function crmAppVersionSyncCommand(version: string): string {
  return envVersionSyncCommand(`${DEPLOY_ROOT}/.env`, 'APP_VERSION', version);
}

/** Restore tracked CRM tree to a release tag after a failed update (pull succeeded, build/seed/health failed). */
export function crmGitCheckoutVersionCommand(version: string): string {
  const tag = shellQuote(`v${version}`);
  return `cd ${DEPLOY_ROOT} && git config --global --add safe.directory ${DEPLOY_ROOT} && git fetch origin --tags && git checkout -f ${tag}`;
}

function composeSetup(): string {
  return `set -a && [ -f ${DEPLOY_ROOT}/.env ] && . ${DEPLOY_ROOT}/.env; set +a && . ${DEPLOY_ROOT}/scripts/compose-files.sh`;
}

/** Run shell body after sourcing crm-update-compose-env.sh (COMPOSE_FILES + host paths). */
export function withComposeEnv(shellBody: string): string {
  const escaped = shellBody.replace(/'/g, `'\"'\"'`);
  return `cd ${DEPLOY_ROOT} && bash -c '. ${DEPLOY_ROOT}/scripts/crm-update-compose-env.sh && ${escaped}'`;
}

function gitSyncMain(root: string): string {
  // Reset tracked files to origin/main; untracked/gitignored (.env, override, local/) are kept.
  return `cd ${root} && git config --global --add safe.directory ${root} && git fetch origin main && if ! git diff --quiet || ! git diff --cached --quiet; then echo 'WARN: discarding local changes to tracked files before update'; fi && git reset --hard origin/main && chmod +x ${root}/scripts/crm-update-build.sh ${root}/scripts/crm-update-ensure-modules-bridge.sh ${root}/scripts/crm-update-health.sh ${root}/scripts/crm-update-compose-env.sh ${root}/scripts/crm-update-sync-host-env.sh 2>/dev/null || true && bash ${root}/scripts/crm-update-sync-host-env.sh`;
}

function stepCommand(component: UpdateComponentId, stepId: string, targetTag: string): string {
  const root = DEPLOY_ROOT;
  const tag = shellQuote(targetTag);

  if (component === 'crm') {
    if (stepId === 'pull') {
      return `${gitSyncMain(root)} && ([ ! -x ${root}/local/apply-server-patches.sh ] || ${root}/local/apply-server-patches.sh)`;
    }
    if (stepId === 'build') {
      // NB: update-bridge и mosquitto исключены — пересборка бриджа убивает процесс
      // обновления; mosquitto не требует пересборки при обновлении CRM.
      // Build list lives in scripts/crm-update-build.sh (git-pulled, incl. modules-bridge).
      return `cd ${root} && export WASH_CRM_UPDATE_V2=1 && ${composeSetup()} && bash ${root}/scripts/crm-update-build.sh`;
    }
    if (stepId === 'seed') {
      return `cd ${root} && export WASH_CRM_UPDATE_V2=1 && ${composeSetup()} && bash ${root}/scripts/crm-update-ensure-modules-bridge.sh || true && docker compose $COMPOSE_FILES run --rm init-seed`;
    }
    if (stepId === 'health') {
      return `cd ${root} && export WASH_CRM_UPDATE_V2=1 && bash ${root}/scripts/crm-update-health.sh`;
    }
  }

  if (component === 'dynamic-api') {
    if (stepId === 'fetch') {
      return `cd ${root} && DYNAMIC_API_REF=${tag} ./scripts/update-dynamic-api.sh`;
    }
    if (stepId === 'build') {
      return `cd ${root} && ${composeSetup()} && docker compose $COMPOSE_FILES up -d --build --no-deps dynamic-api dynamic-api-panel`;
    }
    if (stepId === 'seed') {
      return `cd ${root} && ${composeSetup()} && docker compose $COMPOSE_FILES run --rm init-seed`;
    }
    if (stepId === 'health') {
      return `wget -qO- http://dynamic-api:3001/api/health >/dev/null`;
    }
  }

  if (component === 'pyorchestrator') {
    if (stepId === 'fetch') {
      return `cd ${root} && PYORCHESTRATOR_REF=${tag} ./scripts/update-pyorchestrator.sh`;
    }
    if (stepId === 'build') {
      return `cd ${root} && ${composeSetup()} && docker compose $COMPOSE_FILES up -d --build pyorch-backend pyorchestrator-panel pyorch-bridge`;
    }
    if (stepId === 'health') {
      return `wget -qO- http://pyorch-backend:8000/health >/dev/null || wget -qO- http://pyorch-backend:8000/api/v1/health >/dev/null`;
    }
  }

  throw new Error(`Unknown step ${component}/${stepId}`);
}

function formatShellError(lines: string[], code: number | null): string {
  const blob = lines.filter((l) => !l.startsWith('$ ')).join('\n');
  if (
    /DeadlineExceeded|registry-1\.docker\.io|failed to resolve source metadata|context deadline exceeded/i.test(
      blob
    )
  ) {
    return (
      'Не удалось связаться с Docker Hub (таймаут). Проверьте интернет, VPN и DNS в Docker Desktop. ' +
      'Выполните на хосте: docker pull node:20-alpine && docker pull nginx:alpine — затем повторите обновление. ' +
      'На сервере с доступом к registry сборка проходит нормально; на Mac dev-среде это частая сетевая проблема, не ошибка CRM.'
    );
  }
  const tail = lines.filter((l) => !l.startsWith('$ ')).slice(-4).join('; ');
  return tail || `Команда завершилась с кодом ${code ?? 'unknown'}`;
}

export async function runShell(
  command: string,
  onLog: (line: string) => void,
  extraEnv?: NodeJS.ProcessEnv
): Promise<void> {
  return new Promise((resolve, reject) => {
    const lines: string[] = [];
    const child = spawn('bash', ['-c', command], {
      cwd: DEPLOY_ROOT,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0', ...extraEnv },
    });

    const handle = (chunk: Buffer) => {
      const text = chunk.toString('utf8');
      text.split('\n').forEach((line) => {
        const trimmed = line.trimEnd();
        if (trimmed) {
          lines.push(trimmed);
          onLog(trimmed);
        }
      });
    };

    child.stdout.on('data', handle);
    child.stderr.on('data', handle);
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else {
        reject(new Error(formatShellError(lines, code)));
      }
    });
  });
}

export function getStepCommand(component: UpdateComponentId, stepId: string, targetTag: string): string {
  return stepCommand(component, stepId, targetTag);
}

export function usesCompose(stepId: string): boolean {
  return stepId === 'build' || stepId === 'seed' || stepId === 'health';
}
