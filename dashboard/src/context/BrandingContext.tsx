import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { listCrmSettings } from '../api/crmSettings';
import { DEFAULT_BRANDING, parseBranding, type BrandingSettings } from '../utils/branding';
import { useAuth } from './AuthContext';

const BRANDING_CACHE_KEY = 'wash_branding_cache';

function readCachedBranding(): BrandingSettings {
  try {
    const raw = localStorage.getItem(BRANDING_CACHE_KEY);
    if (!raw) return DEFAULT_BRANDING;
    return parseBranding(JSON.parse(raw));
  } catch {
    return DEFAULT_BRANDING;
  }
}

function writeCachedBranding(branding: BrandingSettings): void {
  try {
    localStorage.setItem(BRANDING_CACHE_KEY, JSON.stringify(branding));
  } catch {
    // ignore quota errors
  }
}

interface BrandingContextValue {
  branding: BrandingSettings;
  refreshBranding: () => Promise<void>;
}

const BrandingContext = createContext<BrandingContextValue | null>(null);

export function BrandingProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [branding, setBranding] = useState<BrandingSettings>(() => readCachedBranding());

  const refreshBranding = useCallback(async () => {
    if (!user) {
      setBranding(readCachedBranding());
      return;
    }
    try {
      const rows = await listCrmSettings();
      const row = rows.find((r) => r.key === 'branding');
      const next = row ? parseBranding(row.value) : DEFAULT_BRANDING;
      setBranding(next);
      writeCachedBranding(next);
    } catch {
      setBranding(readCachedBranding());
    }
  }, [user]);

  useEffect(() => {
    void refreshBranding();
  }, [refreshBranding]);

  const value = useMemo(() => ({ branding, refreshBranding }), [branding, refreshBranding]);

  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
}

export function useBranding(): BrandingContextValue {
  const ctx = useContext(BrandingContext);
  if (!ctx) throw new Error('useBranding requires BrandingProvider');
  return ctx;
}
