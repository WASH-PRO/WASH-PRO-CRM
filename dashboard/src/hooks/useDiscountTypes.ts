import { useCallback, useMemo } from 'react';
import { apiListDictionary } from '../api/client';
import { usePolling } from './usePolling';
import { LIVE_INTERVAL_SLOW_MS } from '../constants/live';
import { discountTypesByCode, resolveDiscountTypeLabel } from '../utils/discountTypes';
import type { DiscountType } from '../types';

export function useDiscountTypes() {
  const fetchTypes = useCallback(
    (signal: AbortSignal) => apiListDictionary<DiscountType>('/crm/discount-types', signal),
    []
  );
  const { data: types, loading, refresh } = usePolling(fetchTypes, [], { intervalMs: LIVE_INTERVAL_SLOW_MS });

  const byCode = useMemo(() => discountTypesByCode(types || []), [types]);

  const label = useCallback(
    (discountType: string | number | undefined) => resolveDiscountTypeLabel(discountType, byCode),
    [byCode]
  );

  return { types: types || [], byCode, label, loading, refresh };
}
