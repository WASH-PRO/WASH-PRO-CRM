import { exec } from 'node:child_process';
import { mkdir, readdir, stat, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import fetch from 'node-fetch';
import { pino } from 'pino';

const execAsync = promisify(exec);
const logger = pino({ level: 'info' });

const MODULES_DIR = process.env.MODULES_DIR || '/modules';
const BACKUP_DIR = process.env.BACKUP_DIR || '/backups';

export async function isFullBundleEnabled(token: string, apiUrl: string): Promise<boolean> {
  try {
    const res = await fetch(`${apiUrl}/api/crm/settings`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = (await res.json()) as {
      success: boolean;
      data?: Array<{ key: string; value: unknown }>;
    };
    const row = json.data?.find((s) => s.key === 'backup');
    const value = row?.value as { fullBundle?: boolean } | undefined;
    return value?.fullBundle !== false;
  } catch {
    return false;
  }
}

export async function createFullBundleExtras(
  token: string,
  apiUrl: string,
  baseName: string
): Promise<string | null> {
  const workDir = join(BACKUP_DIR, `.work-${baseName}`);
  const settingsDir = join(workDir, 'settings');
  const modulesDataDir = join(workDir, 'modules-data');

  try {
    await mkdir(settingsDir, { recursive: true });
    await mkdir(modulesDataDir, { recursive: true });

    const settingsRes = await fetch(`${apiUrl}/api/crm/settings`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const settingsJson = (await settingsRes.json()) as { success: boolean; data?: unknown[] };
    await writeFile(
      join(settingsDir, 'crm-settings.json'),
      JSON.stringify(settingsJson.data ?? [], null, 2),
      'utf8'
    );

    const installedDir = join(MODULES_DIR, 'installed');
    try {
      const moduleIds = await readdir(installedDir);
      for (const moduleId of moduleIds) {
        const dataPath = join(installedDir, moduleId, 'data');
        try {
          const info = await stat(dataPath);
          if (info.isDirectory()) {
            await execAsync(`cp -a "${dataPath}" "${join(modulesDataDir, moduleId)}"`);
          }
        } catch {
          // module has no data directory
        }
      }
    } catch {
      // modules root missing
    }

    const extrasFile = `${baseName}-extras.tar.gz`;
    const extrasPath = join(BACKUP_DIR, extrasFile);
    await execAsync(`tar -czf "${extrasPath}" -C "${workDir}" settings modules-data`);
    logger.info({ extrasFile }, 'Full bundle extras created');
    return extrasFile;
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
