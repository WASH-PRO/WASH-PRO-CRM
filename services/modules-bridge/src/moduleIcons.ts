import fetch from 'node-fetch';
import { existsSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import type { RegistryEntry, WashModuleManifest } from './types.js';
import { isModuleInstalled } from './manifest.js';
import { ICONS_DIR, githubRawUrl, moduleDir } from './paths.js';

const MIME: Record<string, string> = {
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

function contentTypeForPath(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  return MIME[ext] || 'application/octet-stream';
}

function readLocalFile(filePath: string): { body: Buffer; contentType: string } | null {
  if (!existsSync(filePath)) return null;
  return {
    body: readFileSync(filePath),
    contentType: contentTypeForPath(filePath),
  };
}

function readInstalledIcon(moduleId: string, iconPath: string): { body: Buffer; contentType: string } | null {
  if (!isModuleInstalled(moduleId)) return null;
  const rel = iconPath.replace(/^\.\//, '');
  return readLocalFile(join(moduleDir(moduleId), rel));
}

function readBundledIcon(moduleId: string): { body: Buffer; contentType: string } | null {
  for (const ext of ['.svg', '.png', '.webp', '.jpg', '.jpeg']) {
    const file = readLocalFile(join(ICONS_DIR, `${moduleId}${ext}`));
    if (file) return file;
  }
  return null;
}

async function fetchRemoteIcon(
  entry: RegistryEntry,
  iconPath: string
): Promise<{ body: Buffer; contentType: string } | null> {
  const branch = entry.defaultBranch || 'main';
  const rel = iconPath.replace(/^\.\//, '');
  const url = githubRawUrl(entry.repository, branch, rel);
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const body = Buffer.from(await res.arrayBuffer());
    const contentType =
      res.headers.get('content-type')?.split(';')[0]?.trim() || contentTypeForPath(rel);
    return { body, contentType };
  } catch {
    return null;
  }
}

export async function readModuleIcon(
  moduleId: string,
  manifest: WashModuleManifest,
  entry: RegistryEntry
): Promise<{ body: Buffer; contentType: string } | null> {
  const iconPath = manifest.icon || 'assets/icon.svg';

  if (iconPath.startsWith('http://') || iconPath.startsWith('https://')) {
    try {
      const res = await fetch(iconPath);
      if (!res.ok) return null;
      const body = Buffer.from(await res.arrayBuffer());
      const contentType =
        res.headers.get('content-type')?.split(';')[0]?.trim() || 'image/svg+xml';
      return { body, contentType };
    } catch {
      return null;
    }
  }

  return (
    readInstalledIcon(moduleId, iconPath) ??
    readBundledIcon(moduleId) ??
    (await fetchRemoteIcon(entry, iconPath))
  );
}

export function moduleIconPublicUrl(moduleId: string): string {
  return `/api/crm/modules/icon/${encodeURIComponent(moduleId)}`;
}
