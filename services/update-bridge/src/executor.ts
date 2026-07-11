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

function syncEnvVersion(envFile: string, key: string, version: string): string {
  const file = shellQuote(envFile);
  const ver = shellQuote(version);
  return `if [ -f ${file} ]; then sed -i '/^${key}=/d' ${file}; printf '${key}=${ver}\\n' >> ${file}; else printf '${key}=${ver}\\n' > ${file}; fi`;
}

function composeSetup(): string {
  return `set -a && [ -f ${DEPLOY_ROOT}/.env ] && . ${DEPLOY_ROOT}/.env; set +a && . ${DEPLOY_ROOT}/scripts/compose-files.sh`;
}

function gitSyncMain(root: string): string {
  // Reset tracked files to origin/main; untracked/gitignored (.env, override, local/) are kept.
  return `cd ${root} && git config --global --add safe.directory ${root} && git fetch origin main && if ! git diff --quiet || ! git diff --cached --quiet; then echo 'WARN: discarding local changes to tracked files before update'; fi && git reset --hard origin/main`;
}

function stepCommand(component: UpdateComponentId, stepId: string, targetTag: string): string {
  const root = DEPLOY_ROOT;
  const tag = shellQuote(targetTag);

  if (component === 'crm') {
    if (stepId === 'pull') {
      return `${gitSyncMain(root)} && ([ ! -x ${root}/local/apply-server-patches.sh ] || ${root}/local/apply-server-patches.sh) && ${syncEnvVersion(`${root}/.env`, 'APP_VERSION', parseTagVersion(targetTag))}`;
    }
    if (stepId === 'build') {
      // NB: update-bridge и mosquitto исключены — пересборка бриджа убивает процесс
      // обновления; mosquitto не требует пересборки при обновлении CRM.
      return `cd ${root} && ${composeSetup()} && docker compose $COMPOSE_FILES build init-seed && docker compose $COMPOSE_FILES up -d --build --no-deps dynamic-api dynamic-api-panel dashboard message-processor backup`;
    }
    if (stepId === 'seed') {
      return `cd ${root} && ${composeSetup()} && docker compose $COMPOSE_FILES run --rm init-seed`;
    }
    if (stepId === 'health') {
      return `wget -qO- http://dynamic-api:3001/api/health >/dev/null && wget -qO- http://message-processor:3022/health >/dev/null`;
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
      return `cd ${root} && docker compose -f docker-compose.yml -f docker-compose.pyorchestrator.yml up -d --build pyorch-backend pyorchestrator-panel pyorch-bridge`;
    }
    if (stepId === 'health') {
      return `wget -qO- http://pyorch-backend:8000/health >/dev/null || wget -qO- http://pyorch-backend:8000/api/v1/health >/dev/null`;
    }
  }

  throw new Error(`Unknown step ${component}/${stepId}`);
}

export async function runShell(
  command: string,
  onLog: (line: string) => void,
  extraEnv?: NodeJS.ProcessEnv
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('sh', ['-c', command], {
      cwd: DEPLOY_ROOT,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0', ...extraEnv },
    });

    const handle = (chunk: Buffer) => {
      const text = chunk.toString('utf8');
      text.split('\n').forEach((line) => {
        const trimmed = line.trimEnd();
        if (trimmed) onLog(trimmed);
      });
    };

    child.stdout.on('data', handle);
    child.stderr.on('data', handle);
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Команда завершилась с кодом ${code ?? 'unknown'}`));
    });
  });
}

export function getStepCommand(component: UpdateComponentId, stepId: string, targetTag: string): string {
  return stepCommand(component, stepId, targetTag);
}

export function usesCompose(stepId: string): boolean {
  return stepId === 'build' || stepId === 'seed';
}
