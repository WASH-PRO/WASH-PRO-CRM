import { useRefreshMode } from "@/context/RefreshModeContext";
import { useCallback, useEffect, useRef, useState } from "react";

export interface UseLiveQueryOptions<T> {
  enabled?: boolean;
  intervalMs?: number;
  initialData?: T;
}

export interface LiveQueryResult<T> {
  data: T | undefined;
  loading: boolean;
  refreshing: boolean;
  lastUpdated: Date | null;
  reload: () => Promise<void>;
  error: string | null;
}

export function useLiveQuery<T>(
  queryFn: () => Promise<T>,
  deps: unknown[] = [],
  options: UseLiveQueryOptions<T> = {},
): LiveQueryResult<T> {
  const { mode, intervalMs: globalInterval } = useRefreshMode();
  const enabled = options.enabled ?? true;
  const intervalMs = options.intervalMs ?? globalInterval;

  const [data, setData] = useState<T | undefined>(options.initialData);
  const [loading, setLoading] = useState(enabled && options.initialData === undefined);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedRef = useRef(options.initialData !== undefined);

  const queryRef = useRef(queryFn);
  queryRef.current = queryFn;

  const reload = useCallback(
    async (silent = false) => {
      if (!enabled) return;
      if (silent && hasLoadedRef.current) setRefreshing(true);
      else if (!hasLoadedRef.current) setLoading(true);

      try {
        const result = await queryRef.current();
        setData(result);
        setLastUpdated(new Date());
        setError(null);
        hasLoadedRef.current = true;
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [enabled],
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (enabled) reload();
  }, [enabled, reload, ...deps]);

  useEffect(() => {
    if (!enabled || mode !== "live") return;
    const timer = setInterval(() => reload(true), intervalMs);
    return () => clearInterval(timer);
  }, [enabled, mode, intervalMs, reload]);

  return {
    data,
    loading,
    refreshing,
    lastUpdated,
    error,
    reload: () => reload(false),
  };
}
