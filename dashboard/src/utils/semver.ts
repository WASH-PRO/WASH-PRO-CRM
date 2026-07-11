export function parseVersion(tag: string): number[] {
  return tag
    .replace(/^v/i, '')
    .split(/[.+_-]/)
    .map((part) => {
      const n = parseInt(part.replace(/[^0-9].*$/, ''), 10);
      return Number.isFinite(n) ? n : 0;
    });
}

export function isNewerVersion(latest: string, current: string): boolean {
  const a = parseVersion(latest);
  const b = parseVersion(current);
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i += 1) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    if (av > bv) return true;
    if (av < bv) return false;
  }
  return false;
}
