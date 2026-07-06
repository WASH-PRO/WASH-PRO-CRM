import { useCallback, useEffect, useRef, useState } from 'react';
import { useRegisterLiveMode } from '../context/LiveModeContext';

export type PollingFetcher<T> = (signal: AbortSignal) => Promise<T>;

interface UsePollingOptions {
  intervalMs?: number;
  enabled?: boolean;
  /** Показывать индикатор Live в шапке (по умолчанию true) */
  live?: boolean;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

export function usePolling<T>(
  fetcher: PollingFetcher<T>,
  deps: unknown[] = [],
  { intervalMs = 5000, enabled = true, live = true }: UsePollingOptions = {}
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const mounted = useRef(true);
  const requestIdRef = useRef(0);
  const activeControllersRef = useRef<Set<AbortController>>(new Set());

  const refresh = useCallback(async () => {
    const controller = new AbortController();
    activeControllersRef.current.add(controller);
    const requestId = ++requestIdRef.current;

    try {
      const result = await fetcher(controller.signal);
      if (!mounted.current || requestId !== requestIdRef.current) return;
      setData(result);
      setError(null);
      setLastUpdatedAt(Date.now());
    } catch (e) {
      if (!mounted.current || requestId !== requestIdRef.current) return;
      if (isAbortError(e)) return;
      setError(e instanceof Error ? e.message : 'Ошибка загрузки');
    } finally {
      activeControllersRef.current.delete(controller);
      if (mounted.current && requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [fetcher]);

  useEffect(() => {
    mounted.current = true;
    if (!enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    refresh();
    const id = setInterval(refresh, intervalMs);
    return () => {
      mounted.current = false;
      requestIdRef.current += 1;
      for (const controller of activeControllersRef.current) {
        controller.abort();
      }
      activeControllersRef.current.clear();
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh, intervalMs, enabled, ...deps]);

  useRegisterLiveMode(intervalMs, lastUpdatedAt, enabled && live);

  return { data, loading, error, refresh, lastUpdatedAt };
}
