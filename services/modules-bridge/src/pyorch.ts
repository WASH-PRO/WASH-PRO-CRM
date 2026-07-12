import { pino } from 'pino';
import type { ModuleLogsPayload, PyorchRunLog, PyorchRunSummary, PyorchScript } from './types.js';

const logger = pino({ level: 'info' });

const PYORCH_API_URL = (process.env.PYORCH_API_URL || 'http://pyorch-backend:8000').replace(/\/$/, '');
const PYORCH_EMAIL = process.env.PYORCH_EMAIL || 'admin@pyorchestrator.local';
const PYORCH_PASSWORD = process.env.PYORCH_PASSWORD || 'admin';
const CRM_API_BASE = process.env.CRM_API_BASE_URL || 'http://dynamic-api:3001';

let pyorchToken: string | null = null;
let pyorchAvailable: boolean | null = null;
let pyorchCheckedAt = 0;

async function pyorchLogin(): Promise<string> {
  const res = await fetch(`${PYORCH_API_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: PYORCH_EMAIL, password: PYORCH_PASSWORD }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`PyOrchestrator login failed (${res.status}): ${err}`);
  }
  const data = (await res.json()) as { access_token: string };
  pyorchToken = data.access_token;
  return pyorchToken;
}

export async function isPyorchAvailable(force = false): Promise<boolean> {
  const now = Date.now();
  if (!force && pyorchAvailable !== null && now - pyorchCheckedAt < 15000) {
    return pyorchAvailable;
  }
  try {
    const res = await fetch(`${PYORCH_API_URL}/health`, { signal: AbortSignal.timeout(3000) });
    pyorchAvailable = res.ok;
  } catch {
    pyorchAvailable = false;
  }
  pyorchCheckedAt = now;
  return pyorchAvailable;
}

async function pyorchFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (!(await isPyorchAvailable())) {
    throw new Error('PyOrchestrator недоступен. Включите PYORCHESTRATOR_ENABLED=true.');
  }
  if (!pyorchToken) await pyorchLogin();
  const doRequest = async (token: string) =>
    fetch(`${PYORCH_API_URL}/api/v1${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(options.headers as Record<string, string>),
      },
    });

  let res = await doRequest(pyorchToken!);
  if (res.status === 401) {
    await pyorchLogin();
    res = await doRequest(pyorchToken!);
  }
  if (res.status === 204) return undefined as T;
  if (!res.ok) {
    const err = await res.text();
    let detail = err;
    try {
      const parsed = JSON.parse(err) as { detail?: string };
      if (typeof parsed.detail === 'string') detail = parsed.detail;
    } catch {
      /* raw */
    }
    throw new Error(`PyOrchestrator ${path} (${res.status}): ${detail}`);
  }
  return res.json() as Promise<T>;
}

function isWashModule(script: PyorchScript): boolean {
  const meta = script.metadata ?? {};
  return meta.wash_module === true || (meta.source === 'wash-pro-crm' && Boolean(meta.module_id));
}

/** PyOrchestrator injects secrets as SECRET_{KEY}; wash modules read unprefixed env vars. */
const WASH_MODULE_ENV_BOOTSTRAP = `# --- WASH module env bootstrap (modules-bridge) ---
import os as _wash_os
for _wash_k, _wash_v in list(_wash_os.environ.items()):
    if _wash_k.startswith("SECRET_") and _wash_k[7:] not in _wash_os.environ:
        _wash_os.environ[_wash_k[7:]] = _wash_v
# --- end bootstrap ---

`;

export function wrapWashModulePythonCode(code: string): string {
  if (code.includes('WASH module env bootstrap')) {
    return code;
  }
  const marker = 'from __future__ import annotations\n';
  if (code.includes(marker)) {
    return code.replace(marker, `${marker}${WASH_MODULE_ENV_BOOTSTRAP}\n`);
  }
  return WASH_MODULE_ENV_BOOTSTRAP + code;
}

export async function listWashModules(): Promise<PyorchScript[]> {
  const scripts = await pyorchFetch<PyorchScript[]>('/scripts');
  return scripts.filter(isWashModule);
}

export async function getModuleRunLogs(
  scriptId: string,
  limit = 300
): Promise<ModuleLogsPayload> {
  try {
    const script = await getWashModuleScript(scriptId);
    let runId = script?.active_run?.id ?? null;
    let runStatus = script?.active_run?.status ?? null;

    if (!runId) {
      const runs = await pyorchFetch<PyorchRunSummary[]>(
        `/runs/scripts/${scriptId}/runs?limit=1`
      );
      if (runs.length > 0) {
        runId = runs[0]!.id;
        runStatus = runs[0]!.status;
      }
    }

    if (!runId) {
      return { runId: null, runStatus: null, logs: [] };
    }

    const logs = await pyorchFetch<PyorchRunLog[]>(`/runs/${runId}/logs`);
    return {
      runId,
      runStatus,
      logs: logs.slice(-Math.max(1, limit)),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { runId: null, runStatus: null, logs: [], unavailable: message };
  }
}

export async function getWashModuleScript(scriptId: string): Promise<PyorchScript | null> {
  try {
    const script = await pyorchFetch<PyorchScript>(`/scripts/${scriptId}`);
    return isWashModule(script) ? script : null;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('404') || message.includes('not found')) return null;
    throw err;
  }
}

async function setSecret(scriptId: string, key: string, value: string): Promise<void> {
  await pyorchFetch(`/scripts/${scriptId}/secrets`, {
    method: 'POST',
    body: JSON.stringify({ key, value, description: '' }),
  });
}

export async function registerModuleScript(input: {
  moduleId: string;
  name: string;
  description: string;
  code: string;
  entrypoint: string;
  version: string;
  settings: Record<string, unknown>;
  dataDir: string;
}): Promise<PyorchScript> {
  const metadata = {
    wash_module: true,
    source: 'wash-pro-crm',
    module_id: input.moduleId,
    module_version: input.version,
  };

  const existing = (await listWashModules()).find(
    (s) => String(s.metadata.module_id) === input.moduleId
  );

  const code = wrapWashModulePythonCode(input.code);

  if (existing) {
    await pyorchFetch(`/scripts/${existing.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        name: input.name,
        description: input.description,
        code,
        metadata,
      }),
    });
    await applyModuleSecrets(existing.id, input.settings, input.dataDir);
    return (await getWashModuleScript(existing.id)) ?? existing;
  }

  const script = await pyorchFetch<PyorchScript>('/scripts', {
    method: 'POST',
    body: JSON.stringify({
      name: input.name,
      description: input.description,
      script_type: 'daemon',
      entrypoint: input.entrypoint,
      code,
      metadata,
    }),
  });

  await applyModuleSecrets(script.id, input.settings, input.dataDir);
  return script;
}

async function applyModuleSecrets(
  scriptId: string,
  settings: Record<string, unknown>,
  dataDir: string
): Promise<void> {
  await setSecret(scriptId, 'API_BASE_URL', CRM_API_BASE);
  await setSecret(scriptId, 'MODULE_DATA_DIR', dataDir);
  for (const [key, value] of Object.entries(settings)) {
    await setSecret(scriptId, key.toUpperCase(), String(value));
  }
}

export async function startModuleScript(scriptId: string): Promise<PyorchScript> {
  await pyorchFetch(`/runs/scripts/${scriptId}/run`, { method: 'POST' });
  return (await getWashModuleScript(scriptId))!;
}

export async function stopModuleScript(scriptId: string): Promise<void> {
  await pyorchFetch(`/runs/scripts/${scriptId}/stop`, { method: 'POST' }).catch(() => undefined);
}

export async function deleteModuleScript(scriptId: string): Promise<void> {
  await stopModuleScript(scriptId);
  try {
    await pyorchFetch(`/scripts/${scriptId}`, { method: 'DELETE' });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!message.includes('404')) throw err;
  }
}

export async function getModuleRunStatus(scriptId: string): Promise<string | null> {
  try {
    const script = await getWashModuleScript(scriptId);
    return script?.active_run?.status ?? null;
  } catch {
    return null;
  }
}

export async function syncModuleSecrets(
  scriptId: string,
  settings: Record<string, unknown>,
  dataDir: string
): Promise<void> {
  await applyModuleSecrets(scriptId, settings, dataDir);
}

