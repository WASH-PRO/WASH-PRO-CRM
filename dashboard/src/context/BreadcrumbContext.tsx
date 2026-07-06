import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

interface BreadcrumbContextValue {
  lastLabel: string | null;
  setLastLabel: (label: string | null) => void;
}

const BreadcrumbContext = createContext<BreadcrumbContextValue | null>(null);

export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const [lastLabel, setLastLabelState] = useState<string | null>(null);

  const setLastLabel = useCallback((label: string | null) => {
    setLastLabelState(label);
  }, []);

  const value = useMemo(() => ({ lastLabel, setLastLabel }), [lastLabel, setLastLabel]);

  return <BreadcrumbContext.Provider value={value}>{children}</BreadcrumbContext.Provider>;
}

function useBreadcrumbContext() {
  const ctx = useContext(BreadcrumbContext);
  if (!ctx) {
    throw new Error('useBreadcrumbLastLabel must be used within BreadcrumbProvider');
  }
  return ctx;
}

/** Переопределяет текст последней хлебной крошки на текущей странице. */
export function useBreadcrumbLastLabel(label: string | null | undefined) {
  const { setLastLabel } = useBreadcrumbContext();

  useEffect(() => {
    setLastLabel(label ?? null);
    return () => setLastLabel(null);
  }, [label, setLastLabel]);
}

export function useBreadcrumbLastLabelOverride() {
  return useBreadcrumbContext().lastLabel;
}
