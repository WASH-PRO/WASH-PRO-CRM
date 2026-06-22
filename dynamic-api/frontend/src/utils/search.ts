import { useEffect, useState } from 'react';

export function matchesSearch(query: string, ...values: (string | number | undefined | null)[]): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return values.some((value) => value != null && String(value).toLowerCase().includes(q));
}

export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
