import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

const STORAGE_KEY = 'wash-crm-live-enabled';

function readStoredLiveEnabled(): boolean {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value === 'false') return false;
    if (value === 'true') return true;
  } catch {
    // ignore
  }
  return true;
}

function persistLiveEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(enabled));
  } catch {
    // ignore
  }
}

interface LiveModeContextValue {
  liveEnabled: boolean;
  setLiveEnabled: (enabled: boolean) => void;
  toggleLiveEnabled: () => void;
}

const LiveModeContext = createContext<LiveModeContextValue | null>(null);

export function LiveModeProvider({ children }: { children: ReactNode }) {
  const [liveEnabled, setLiveEnabledState] = useState(readStoredLiveEnabled);

  const setLiveEnabled = useCallback((enabled: boolean) => {
    setLiveEnabledState(enabled);
    persistLiveEnabled(enabled);
  }, []);

  const toggleLiveEnabled = useCallback(() => {
    setLiveEnabledState((prev) => {
      const next = !prev;
      persistLiveEnabled(next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ liveEnabled, setLiveEnabled, toggleLiveEnabled }),
    [liveEnabled, setLiveEnabled, toggleLiveEnabled]
  );

  return <LiveModeContext.Provider value={value}>{children}</LiveModeContext.Provider>;
}

export function useLiveMode() {
  const ctx = useContext(LiveModeContext);
  if (!ctx) {
    throw new Error('useLiveMode must be used within LiveModeProvider');
  }
  return ctx;
}
