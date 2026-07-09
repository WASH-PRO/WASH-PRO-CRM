import { useCallback, useEffect, useRef, useState } from 'react';
import { useLiveMode } from '../context/LiveModeContext';

export type PollingFetcher<T> = (signal: AbortSignal) => Promise<T>;

interface UsePollingOptions {
  intervalMs?: number;
  enabled?: boolean;
  /** Таймаут одного запроса, мс */
  timeoutMs?: number;
  /** @deprecated Используйте глобальный переключатель Live/Статика в шапке */
  live?: boolean;
}

const DEFAULT_TIMEOUT_MS = 60_000;

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

async function runWithTimeout<T>(fetcher: PollingFetcher<T>, signal: AbortSignal, timeoutMs: number): Promise<T> {
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error('Превышено время ожидания ответа сервера'));
    }, timeoutMs);

    const onAbort = () => {
      window.clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    };

    signal.addEventListener('abort', onAbort, { once: true });

    fetcher(signal)
      .then((value) => {
        window.clearTimeout(timer);
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      })
      .catch((error) => {
        window.clearTimeout(timer);
        signal.removeEventListener('abort', onAbort);
        reject(error);
      });
  });
}

export function usePolling<T>(
  fetcher: PollingFetcher<T>,
  deps: unknown[] = [],
  { intervalMs = 5000, enabled = true, timeoutMs = DEFAULT_TIMEOUT_MS }: UsePollingOptions = {}
) {
  const { liveEnabled } = useLiveMode();
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
      const result = await runWithTimeout(fetcher, controller.signal, timeoutMs);
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
  }, [fetcher, timeoutMs]);

  useEffect(() => {
    mounted.current = true;
    if (!enabled) {
      setLoading(false);
      return () => {
        mounted.current = false;
        requestIdRef.current += 1;
      };
    }
    setLoading(true);
    refresh();
    if (!liveEnabled) {
      return () => {
        mounted.current = false;
        requestIdRef.current += 1;
        for (const controller of activeControllersRef.current) {
          controller.abort();
        }
        activeControllersRef.current.clear();
      };
    }
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
  }, [refresh, intervalMs, enabled, liveEnabled, ...deps]);

  const setDataSafe = useCallback((value: T | null | ((prev: T | null) => T | null)) => {
    if (!mounted.current) return;
    setData(value);
    setLastUpdatedAt(Date.now());
  }, []);

  return { data, setData: setDataSafe, loading, error, refresh, lastUpdatedAt };
}
