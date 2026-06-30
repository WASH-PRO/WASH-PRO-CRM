import { useCallback } from 'react';
import { LIVE_INTERVAL_SLOW_MS } from '../constants/live';
import { usePolling } from './usePolling';

export type ServiceStatus = 'online' | 'offline' | 'checking';

export interface EmbeddedService {
  id: string;
  label: string;
  panelUrl: string;
  status: ServiceStatus;
}

function hostBase(): string {
  return typeof window !== 'undefined' ? window.location.hostname : 'localhost';
}

async function checkDynamicApi(): Promise<boolean> {
  try {
    const res = await fetch('/api/health', { cache: 'no-store' });
    const json = (await res.json()) as { success?: boolean };
    return res.ok && json.success === true;
  } catch {
    return false;
  }
}

async function checkPyOrchestrator(): Promise<boolean> {
  try {
    const res = await fetch('/api/telegram-bots/health', { cache: 'no-store' });
    if (!res.ok) return false;
    const json = (await res.json()) as { ok?: boolean };
    return json.ok === true;
  } catch {
    return false;
  }
}

export function useEmbeddedServices(): EmbeddedService[] {
  const fetchStatus = useCallback(async () => {
    const host = hostBase();
    const [dapOnline, pyorchOnline] = await Promise.all([checkDynamicApi(), checkPyOrchestrator()]);

    return [
      {
        id: 'dynamic-api',
        label: 'Dynamic API',
        panelUrl: `http://${host}:8080`,
        status: dapOnline ? 'online' : 'offline',
      },
      {
        id: 'pyorchestrator',
        label: 'PyOrchestrator',
        panelUrl: `http://${host}:8090`,
        status: pyorchOnline ? 'online' : 'offline',
      },
    ] satisfies EmbeddedService[];
  }, []);

  const { data } = usePolling(fetchStatus, [], {
    intervalMs: LIVE_INTERVAL_SLOW_MS,
    live: false,
  });

  if (!data) {
    return [
      { id: 'dynamic-api', label: 'Dynamic API', panelUrl: `http://${hostBase()}:8080`, status: 'checking' },
      { id: 'pyorchestrator', label: 'PyOrchestrator', panelUrl: `http://${hostBase()}:8090`, status: 'checking' },
    ];
  }

  return data;
}
