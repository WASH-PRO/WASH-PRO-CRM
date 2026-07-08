import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { isAbsolute, join } from 'node:path';

const DEPLOY_ROOT = (process.env.DEPLOY_ROOT || '/deploy').replace(/\/+$/, '') || '/deploy';

/** Host source path for a bind mount (Linux /proc/self/mountinfo). */
function resolveHostBindPath(containerPath: string): string | null {
  const normalized = containerPath.replace(/\/+$/, '') || '/';
  try {
    const info = readFileSync('/proc/self/mountinfo', 'utf8');
    for (const line of info.split('\n')) {
      const dashIdx = line.indexOf(' - ');
      if (dashIdx < 0) continue;
      const before = line.slice(0, dashIdx).split(' ');
      const after = line.slice(dashIdx + 3).split(' ');
      const mountpoint = before[4];
      if (mountpoint !== normalized) continue;
      const root = after[2];
      const mountSource = before[3];
      if (root && root !== '/') {
        return `${root}${mountSource}`.replace(/\/+/g, '/');
      }
      return mountSource;
    }
  } catch {
    // not Linux or unreadable
  }
  return null;
}

function detectDeployMountSource(): string | null {
  try {
    for (const line of readFileSync('/proc/self/mountinfo', 'utf8').split('\n')) {
      const parts = line.split(' ');
      if (parts.length < 10 || parts[4] !== DEPLOY_ROOT) continue;
      const dash = parts.indexOf('-');
      if (dash < 0) continue;
      const fsType = parts[dash + 1];
      if (fsType === 'bind') {
        const source = parts[dash + 2]?.replace(/\\040/g, ' ');
        if (source?.startsWith('/') && source !== DEPLOY_ROOT) return source;
      }
      if (fsType === 'fakeowner') {
        const root = parts[3];
        if (root?.startsWith('/')) return `/Users/${root.replace(/^\//, '')}`;
      }
    }
  } catch {
    // ignore
  }
  return null;
}

function detectViaDockerInspect(): string | null {
  const containerId = process.env.HOSTNAME?.trim();
  if (!containerId) return null;
  try {
    const source = execSync(
      `docker inspect -f '{{range .Mounts}}{{if eq .Destination "${DEPLOY_ROOT}"}}{{.Source}}{{end}}{{end}}' ${containerId}`,
      { encoding: 'utf8' }
    ).trim();
    if (source && source !== DEPLOY_ROOT) return source;
  } catch {
    // ignore
  }
  return null;
}

export function resolveHostProjectRoot(): string {
  const override = process.env.HOST_PROJECT_ROOT?.trim() || process.env.WASH_HOST_PROJECT_ROOT?.trim();
  if (override && override !== '.' && override !== DEPLOY_ROOT && isAbsolute(override)) {
    return override.replace(/\/+$/, '');
  }

  const detected =
    detectViaDockerInspect() ||
    detectDeployMountSource() ||
    resolveHostBindPath(DEPLOY_ROOT);

  if (detected && detected !== DEPLOY_ROOT) {
    return detected.replace(/\/+$/, '');
  }

  return DEPLOY_ROOT;
}

export function resolveHostDataDir(): string {
  const explicit = process.env.HOST_DATA_DIR?.trim();
  if (explicit) return explicit;

  const configured = process.env.DATA_DIR?.trim() || './data';
  if (isAbsolute(configured)) return configured;

  const hostRoot = resolveHostProjectRoot();
  const relative = configured.replace(/^\.\//, '');
  return join(hostRoot, relative).replace(/\/+/g, '/');
}

export function composeCommandEnv(): NodeJS.ProcessEnv {
  const hostRoot = resolveHostProjectRoot();
  const hostData = resolveHostDataDir();
  const buildRoot = hostRoot !== DEPLOY_ROOT ? DEPLOY_ROOT : hostRoot;
  return {
    ...process.env,
    DATA_DIR: hostData,
    HOST_PROJECT_ROOT: hostRoot,
    WASH_HOST_PROJECT_ROOT: hostRoot,
    WASH_BUILD_ROOT: buildRoot,
    HOST_DATA_DIR: hostData,
    COMPOSE_PROJECT_NAME: process.env.COMPOSE_PROJECT_NAME || 'wash-pro-crm',
  };
}
