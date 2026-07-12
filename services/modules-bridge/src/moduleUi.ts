import fetch from 'node-fetch';
import { loadRegistry, findRegistryEntry } from './catalog.js';
import { readLocalManifest } from './manifest.js';
import { moduleUiDir } from './paths.js';
import { existsSync, readFileSync } from 'node:fs';
import { join, normalize } from 'node:path';
import { githubRawUrl } from './paths.js';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json; charset=utf-8',
};

function resolveHelpPath(moduleId: string): string {
  const manifest = readLocalManifest(moduleId);
  return manifest?.helpPage || 'ui/help.html';
}

export async function readModuleUiFile(
  moduleId: string,
  relativePath: string
): Promise<{ body: Buffer; contentType: string } | null> {
  const uiRoot = moduleUiDir(moduleId);
  let path = relativePath || 'index.html';
  if (path.endsWith('/')) path += 'index.html';

  if (existsSync(uiRoot)) {
    const resolved = normalize(join(uiRoot, path.replace(/^ui\//, '')));
    const normalizedRoot = normalize(uiRoot);
    if (resolved.startsWith(normalizedRoot) && existsSync(resolved)) {
      const ext = resolved.slice(resolved.lastIndexOf('.'));
      return {
        body: readFileSync(resolved),
        contentType: MIME[ext] || 'application/octet-stream',
      };
    }
    // helpPage may be ui/help.html — try under uiRoot directly
    const alt = normalize(join(uiRoot, path.startsWith('ui/') ? path.slice(3) : path));
    if (alt.startsWith(normalizedRoot) && existsSync(alt)) {
      const ext = alt.slice(alt.lastIndexOf('.'));
      return {
        body: readFileSync(alt),
        contentType: MIME[ext] || 'application/octet-stream',
      };
    }
  }

  const registry = await loadRegistry();
  const entry = findRegistryEntry(moduleId, registry);
  if (!entry) return null;

  const branch = entry.defaultBranch || 'main';
  const remotePath = path.startsWith('ui/') ? path : `ui/${path}`;
  const url = githubRawUrl(entry.repository, branch, remotePath);
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const ext = remotePath.slice(remotePath.lastIndexOf('.'));
    return {
      body: Buffer.from(await res.arrayBuffer()),
      contentType: MIME[ext] || 'text/plain; charset=utf-8',
    };
  } catch {
    return null;
  }
}

export async function readModuleHelpFile(moduleId: string): Promise<{ body: Buffer; contentType: string } | null> {
  const helpPath = resolveHelpPath(moduleId);
  return readModuleUiFile(moduleId, helpPath);
}

export async function moduleHelpExists(moduleId: string): Promise<boolean> {
  const file = await readModuleHelpFile(moduleId);
  return file !== null;
}
