function normalizePath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) return '/';
  const withLeading = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return withLeading.replace(/\/+$/, '') || '/';
}

export function getVersionedApiPath(path: string, apiVersion?: string): string {
  const normalized = normalizePath(path);
  const version = apiVersion?.trim();
  if (!version) return normalized;
  const v = version.startsWith('v') ? version : `v${version}`;
  if (normalized.includes(`/api/${v}/`)) return normalized;
  return normalized.replace(/^\/api\//, `/api/${v}/`);
}

export function getEndpointPublicPaths(path: string, apiVersion?: string): string[] {
  const normalized = normalizePath(path);
  const paths = new Set<string>([normalized]);
  const versioned = getVersionedApiPath(path, apiVersion);
  if (versioned !== normalized) {
    paths.add(versioned);
  }
  return [...paths];
}

export function getEndpointDisplayPath(path: string, apiVersion?: string): string {
  return getVersionedApiPath(path, apiVersion);
}

export function getDefaultTestPath(path: string, apiVersion?: string): string {
  return apiVersion?.trim() ? getVersionedApiPath(path, apiVersion) : normalizePath(path);
}
