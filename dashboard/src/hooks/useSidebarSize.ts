import { useCallback, useEffect, useState, type MouseEvent } from 'react';

export const SIDEBAR_COLLAPSED_WIDTH = 72;
export const SIDEBAR_DEFAULT_WIDTH = 256;
export const SIDEBAR_MIN_WIDTH = 200;
export const SIDEBAR_MAX_WIDTH = 420;

function clampWidth(value: number): number {
  return Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, value));
}

function storageKey(userKey: string, suffix: 'collapsed' | 'width'): string {
  return `wash_sidebar_${suffix}_${userKey}`;
}

function readCollapsed(userKey: string): boolean {
  const perUser = localStorage.getItem(storageKey(userKey, 'collapsed'));
  if (perUser != null) return perUser === '1';
  return localStorage.getItem('wash_sidebar_collapsed') === '1';
}

function readWidth(userKey: string): number {
  const perUser = localStorage.getItem(storageKey(userKey, 'width'));
  if (perUser != null) {
    const n = Number(perUser);
    if (Number.isFinite(n)) return clampWidth(n);
  }
  return SIDEBAR_DEFAULT_WIDTH;
}

export function useSidebarSize(userKey: string | undefined) {
  const [collapsed, setCollapsed] = useState(false);
  const [width, setWidth] = useState(SIDEBAR_DEFAULT_WIDTH);
  const [resizing, setResizing] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!userKey) {
      setHydrated(true);
      return;
    }
    setCollapsed(readCollapsed(userKey));
    setWidth(readWidth(userKey));
    setHydrated(true);
  }, [userKey]);

  useEffect(() => {
    if (!userKey || !hydrated) return;
    localStorage.setItem(storageKey(userKey, 'collapsed'), collapsed ? '1' : '0');
  }, [collapsed, userKey, hydrated]);

  useEffect(() => {
    if (!userKey || !hydrated || collapsed) return;
    localStorage.setItem(storageKey(userKey, 'width'), String(width));
  }, [width, collapsed, userKey, hydrated]);

  const startResize = useCallback((event: MouseEvent) => {
    event.preventDefault();
    setResizing(true);
  }, []);

  useEffect(() => {
    if (!resizing) return;

    const onMove = (event: globalThis.MouseEvent) => {
      setWidth(clampWidth(event.clientX));
    };
    const onUp = () => setResizing(false);

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [resizing]);

  const effectiveWidth = collapsed ? SIDEBAR_COLLAPSED_WIDTH : width;

  return {
    collapsed,
    setCollapsed,
    effectiveWidth,
    resizing,
    startResize,
    canResize: !collapsed,
  };
}
