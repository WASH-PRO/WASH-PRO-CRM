import { useCallback } from 'react';
import { getUpdatesStatus, type UpdatesStatus } from '../api/updates';
import { usePolling } from './usePolling';

export function useSoftwareUpdates(enabled = true) {
  const fetchStatus = useCallback(async () => getUpdatesStatus(false), []);

  const { data, loading, refresh, lastUpdatedAt } = usePolling(fetchStatus, [], {
    intervalMs: 60_000,
    enabled,
    live: false,
  });

  const refreshStatus = useCallback(async (): Promise<UpdatesStatus> => {
    const status = await getUpdatesStatus(true);
    await refresh();
    return status;
  }, [refresh]);

  const fastPoll = Boolean(data?.activeJob);

  return {
    status: data,
    loading: loading && !data,
    refresh: refreshStatus,
    lastUpdatedAt,
    fastPoll,
  };
}
