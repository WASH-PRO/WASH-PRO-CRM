import { useCallback, useMemo } from 'react';
import { apiListDictionary } from '../api/client';
import { usePolling } from './usePolling';
import { LIVE_INTERVAL_SLOW_MS } from '../constants/live';
import type { WorkMode } from '../types';
import { resolveWorkModeLabel, workModesByCode } from '../utils/workModes';

export function useWorkModes() {
  const fetchModes = useCallback(
    (signal: AbortSignal) => apiListDictionary<WorkMode>('/crm/work-modes', signal),
    []
  );
  const { data: modes, loading, refresh } = usePolling(fetchModes, [], {
    intervalMs: LIVE_INTERVAL_SLOW_MS,
    live: false,
  });

  const byCode = useMemo(() => workModesByCode(modes || []), [modes]);

  const label = useCallback(
    (modeRef: string | number | undefined) => resolveWorkModeLabel(modeRef, byCode),
    [byCode]
  );

  return { modes: modes || [], byCode, label, loading, refresh };
}
