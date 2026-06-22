import os from 'os';
import fs from 'fs/promises';
import path from 'path';
import { env } from '../config/env';

export interface SystemInfo {
  hostname: string;
  platform: string;
  osType: string;
  osRelease: string;
  osVersion: string;
  architecture: string;
  cpuModel: string;
  cpuCores: number;
  cpuSpeed: number;
  totalMemory: number;
  freeMemory: number;
  usedMemory: number;
  memoryUsagePercent: number;
  uptime: number;
  nodeVersion: string;
  appVersion: string;
  appName: string;
  environment: string;
  disk: {
    total: number;
    free: number;
    used: number;
    usagePercent: number;
    mount: string;
  };
  files: {
    appFiles: number;
    logFiles: number;
    totalProjectFiles: number;
  };
  network: {
    interfaces: { name: string; address: string; family: string }[];
  };
  loadAverage: number[];
  timestamp: string;
}

async function countFiles(dir: string, maxDepth = 5, depth = 0): Promise<number> {
  if (depth > maxDepth) return 0;
  let count = 0;
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        count += await countFiles(fullPath, maxDepth, depth + 1);
      } else if (entry.isFile()) {
        count++;
      }
    }
  } catch {
    // ignore inaccessible dirs
  }
  return count;
}

async function getDiskStats(mountPath: string) {
  try {
    const stats = await fs.statfs(mountPath);
    const total = Number(stats.bsize) * stats.blocks;
    const free = Number(stats.bsize) * stats.bavail;
    const used = total - free;
    return {
      total,
      free,
      used,
      usagePercent: total > 0 ? Math.round((used / total) * 100) : 0,
      mount: mountPath,
    };
  } catch {
    return { total: 0, free: 0, used: 0, usagePercent: 0, mount: mountPath };
  }
}

export class SystemService {
  async getInfo(): Promise<SystemInfo> {
    const cpus = os.cpus();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;

    const networkInterfaces = os.networkInterfaces();
    const interfaces: SystemInfo['network']['interfaces'] = [];
    for (const [name, addrs] of Object.entries(networkInterfaces)) {
      if (!addrs) continue;
      for (const addr of addrs) {
        if (!addr.internal) {
          interfaces.push({ name, address: addr.address, family: addr.family });
        }
      }
    }

    const [disk, appFiles, logFiles] = await Promise.all([
      getDiskStats('/'),
      countFiles('/app'),
      countFiles('/app/logs').catch(() => 0),
    ]);

    return {
      hostname: os.hostname(),
      platform: os.platform(),
      osType: os.type(),
      osRelease: os.release(),
      osVersion: `${os.type()} ${os.release()} (${os.arch()})`,
      architecture: os.arch(),
      cpuModel: cpus[0]?.model || 'Unknown',
      cpuCores: cpus.length,
      cpuSpeed: cpus[0]?.speed || 0,
      totalMemory,
      freeMemory,
      usedMemory,
      memoryUsagePercent: Math.round((usedMemory / totalMemory) * 100),
      uptime: os.uptime(),
      nodeVersion: process.version,
      appVersion: '1.0.0',
      appName: 'Dynamic API Platform',
      environment: env.nodeEnv,
      disk,
      files: {
        appFiles,
        logFiles,
        totalProjectFiles: appFiles + logFiles,
      },
      network: { interfaces },
      loadAverage: os.loadavg(),
      timestamp: new Date().toISOString(),
    };
  }
}

export const systemService = new SystemService();
