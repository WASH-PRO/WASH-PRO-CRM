import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "@/context/LocaleContext";

export type RefreshMode = "live" | "static";

const MODE_KEY = "pyorch-refresh-mode";
const INTERVAL_KEY = "pyorch-refresh-interval";

export const REFRESH_INTERVALS = [5, 10, 30, 60] as const;
export type RefreshInterval = (typeof REFRESH_INTERVALS)[number];

interface RefreshModeContextValue {
  mode: RefreshMode;
  setMode: (mode: RefreshMode) => void;
  intervalMs: number;
  setIntervalSec: (sec: RefreshInterval) => void;
  isLive: boolean;
}

const RefreshModeContext = createContext<RefreshModeContextValue | null>(null);

function readMode(): RefreshMode {
  const v = localStorage.getItem(MODE_KEY);
  return v === "static" ? "static" : "live";
}

function readInterval(): RefreshInterval {
  const v = Number(localStorage.getItem(INTERVAL_KEY));
  return REFRESH_INTERVALS.includes(v as RefreshInterval) ? (v as RefreshInterval) : 10;
}

export function RefreshModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<RefreshMode>(readMode);
  const [intervalSec, setIntervalSecState] = useState<RefreshInterval>(readInterval);

  const setMode = useCallback((next: RefreshMode) => {
    setModeState(next);
    localStorage.setItem(MODE_KEY, next);
  }, []);

  const setIntervalSec = useCallback((sec: RefreshInterval) => {
    setIntervalSecState(sec);
    localStorage.setItem(INTERVAL_KEY, String(sec));
  }, []);

  const value = useMemo(
    () => ({
      mode,
      setMode,
      intervalMs: intervalSec * 1000,
      setIntervalSec,
      isLive: mode === "live",
    }),
    [mode, setMode, intervalSec, setIntervalSec],
  );

  return <RefreshModeContext.Provider value={value}>{children}</RefreshModeContext.Provider>;
}

export function useRefreshMode() {
  const ctx = useContext(RefreshModeContext);
  if (!ctx) throw new Error("useRefreshMode must be used within RefreshModeProvider");
  return ctx;
}

/** Human-readable “updated Ns ago” */
export function useRelativeTime(date: Date | null) {
  const { t } = useTranslation();
  const [, tick] = useState(0);

  useEffect(() => {
    if (!date) return;
    const timer = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, [date]);

  if (!date) return null;
  const sec = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (sec < 5) return t("refresh.justNow");
  if (sec < 60) return t("refresh.secondsAgo", { sec });
  const min = Math.floor(sec / 60);
  return t("refresh.minutesAgo", { min });
}
