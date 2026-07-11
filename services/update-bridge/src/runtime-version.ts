import { execFileSync } from 'node:child_process';

const TIMEOUT_MS = 4000;

export function readHttpJson(url: string): Record<string, unknown> | null {
  try {
    const raw = execFileSync('wget', ['-qO-', `--timeout=${Math.ceil(TIMEOUT_MS / 1000)}`, url], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function readRunningDashboardVersion(): string | null {
  const json = readHttpJson('http://dashboard/version.json');
  const version = json?.version;
  return typeof version === 'string' && version.trim() ? version.trim() : null;
}
