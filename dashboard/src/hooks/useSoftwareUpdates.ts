import { useCallback } from 'react';
import { getUpdatesStatus, isBlockingActiveJob, type UpdatesStatus } from '../api/updates';
import { usePolling } from './usePolling';

export function useSoftwareUpdates(enabled = true) {
  const fetchStatus = useCallback(async () => getUpdatesStatus(false), []);

  const { data, loading, refresh, lastUpdatedAt } = usePolling(fetchStatus, [], {
    intervalMs: 60_000,
    enabled,
    live: false,
  });

  /** Обновить статус из кэша (прогресс job, dismiss) — без запросов к GitHub */
  const refreshCached = useCallback(async (): Promise<UpdatesStatus> => {
    const status = await getUpdatesStatus(false);
    await refresh();
    return status;
  }, [refresh]);

  /** Принудительная проверка релизов на GitHub */
  const refreshFromGithub = useCallback(async (): Promise<UpdatesStatus> => {
    const status = await getUpdatesStatus(true);
    await refresh();
    return status;
  }, [refresh]);

  const fastPoll = isBlockingActiveJob(data);

  return {
    status: data,
    loading: loading && !data,
    refresh: refreshCached,
    checkGithub: refreshFromGithub,
    lastUpdatedAt,
    fastPoll,
  };
}
