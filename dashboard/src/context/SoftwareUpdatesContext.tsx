import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { useSoftwareUpdates } from '../hooks/useSoftwareUpdates';
import type { UpdatesStatus } from '../api/updates';

interface SoftwareUpdatesContextValue {
  status: UpdatesStatus | null;
  loading: boolean;
  refresh: () => Promise<UpdatesStatus>;
}

const SoftwareUpdatesContext = createContext<SoftwareUpdatesContextValue | null>(null);

export function SoftwareUpdatesProvider({ children }: { children: ReactNode }) {
  const { hasPermission } = useAuth();
  const canManageUpdates = hasPermission('manage_users', 'manage_api');
  const { status, loading, refresh, fastPoll } = useSoftwareUpdates(canManageUpdates);

  useEffect(() => {
    if (!canManageUpdates || !fastPoll) return;
    const id = setInterval(() => {
      void refresh();
    }, 3000);
    return () => clearInterval(id);
  }, [canManageUpdates, fastPoll, refresh]);

  return (
    <SoftwareUpdatesContext.Provider value={{ status, loading, refresh }}>
      {children}
    </SoftwareUpdatesContext.Provider>
  );
}

export function useSoftwareUpdatesContext(): SoftwareUpdatesContextValue | null {
  return useContext(SoftwareUpdatesContext);
}
