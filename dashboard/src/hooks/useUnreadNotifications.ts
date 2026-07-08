import { useCallback } from 'react';
import { countUnreadWebNotifications } from '../utils/notificationsTable';
import { usePolling } from './usePolling';

export function useUnreadNotifications() {
  const fetchUnread = useCallback((signal: AbortSignal) => countUnreadWebNotifications(signal), []);
  const { data, loading } = usePolling(fetchUnread, [], {
    intervalMs: 10_000,
    live: true,
  });
  return { unreadCount: data ?? 0, loading };
}
