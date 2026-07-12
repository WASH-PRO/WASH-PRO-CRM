import http from 'node:http';
import { pino } from 'pino';
import { verifyAdmin } from './auth.js';
import { buildCatalog, fetchManifestFromRepo, findRegistryEntry, loadRegistry } from './catalog.js';
import {
  installModule,
  readModuleDataFile,
  readModuleSettings,
  saveModuleSettings,
  startModule,
  stopModule,
  uninstallModule,
  updateModule,
} from './installer.js';
import { readLocalManifest } from './manifest.js';
import { readModuleIcon } from './moduleIcons.js';
import { readModuleUiFile } from './moduleUi.js';
import {
  getModuleRunLogs,
  getModuleRunStatus,
  isPyorchAvailable,
} from './pyorch.js';
import { getInstalledState, listInstalledStates } from './state.js';

const logger = pino({ level: 'info' });
const PORT = parseInt(process.env.MODULES_HTTP_PORT || '3024', 10);

async function readBody(req: http.IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

function json(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function serveModuleUi(moduleId: string, subPath: string, res: http.ServerResponse): void {
  void (async () => {
    let relative = subPath || 'index.html';
    if (relative.endsWith('/')) relative += 'index.html';
    if (relative.startsWith('/')) relative = relative.slice(1);

    const file = await readModuleUiFile(moduleId, relative);
    if (!file) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': file.contentType });
    res.end(file.body);
  })().catch((err) => {
    logger.error({ err, moduleId }, 'serveModuleUi failed');
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Internal error');
  });
}

function serveModuleIcon(moduleId: string, res: http.ServerResponse): void {
  void (async () => {
    const registry = await loadRegistry();
    const entry = findRegistryEntry(moduleId, registry);
    if (!entry) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }

    let manifest = readLocalManifest(moduleId);
    if (!manifest) {
      manifest = await fetchManifestFromRepo(entry);
    }
    if (!manifest && entry.manifest) {
      manifest = entry.manifest;
    }
    if (!manifest) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }

    const file = await readModuleIcon(moduleId, manifest, entry);
    if (!file) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }

    res.writeHead(200, {
      'Content-Type': file.contentType,
      'Cache-Control': 'public, max-age=300',
    });
    res.end(file.body);
  })().catch((err) => {
    logger.error({ err, moduleId }, 'serveModuleIcon failed');
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Internal error');
  });
}

async function handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const url = req.url?.split('?')[0] ?? '';
  const refresh = req.url?.includes('refresh=1') ?? false;

  if (req.method === 'GET' && url === '/health') {
    const pyorch = await isPyorchAvailable();
    json(res, 200, { success: true, data: { pyorchAvailable: pyorch } });
    return;
  }

  const uiMatch = url.match(/^\/ui\/([^/]+)(\/.*)?$/);
  if (req.method === 'GET' && uiMatch) {
    serveModuleUi(decodeURIComponent(uiMatch[1]!), uiMatch[2] || '', res);
    return;
  }

  const iconMatch = url.match(/^\/icon\/([^/]+)$/);
  if ((req.method === 'GET' || req.method === 'HEAD') && iconMatch) {
    serveModuleIcon(decodeURIComponent(iconMatch[1]!), res);
    return;
  }

  const auth = await verifyAdmin(req.headers.authorization);
  if (!auth.ok) {
    const message = auth.status === 403 ? 'Forbidden' : 'Unauthorized';
    res.writeHead(auth.status, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(message);
    return;
  }

  if (req.method === 'GET' && url === '/catalog') {
    try {
      const data = await buildCatalog(refresh);
      json(res, 200, { success: true, data });
    } catch (err) {
      json(res, 500, { success: false, error: err instanceof Error ? err.message : 'Catalog failed' });
    }
    return;
  }

  if (req.method === 'GET' && url === '/installed') {
    const states = listInstalledStates();
    const enriched = states.map((state) => ({
      ...state,
      manifest: readLocalManifest(state.id),
    }));
    json(res, 200, { success: true, data: enriched });
    return;
  }

  const installMatch = url.match(/^\/install\/([^/]+)$/);
  if (req.method === 'POST' && installMatch) {
    const moduleId = decodeURIComponent(installMatch[1]!);
    try {
      const data = await installModule(moduleId);
      json(res, 201, { success: true, data });
    } catch (err) {
      json(res, 400, { success: false, error: err instanceof Error ? err.message : 'Install failed' });
    }
    return;
  }

  const moduleMatch = url.match(/^\/installed\/([^/]+)(\/start|\/stop|\/update|\/settings|\/status|\/logs|\/data\/([^/]+))?$/);
  if (moduleMatch) {
    const moduleId = decodeURIComponent(moduleMatch[1]!);
    const action = moduleMatch[2];
    const dataFile = moduleMatch[3];

    if (req.method === 'GET' && !action) {
      const state = getInstalledState(moduleId);
      const manifest = readLocalManifest(moduleId);
      if (!state || !manifest) {
        json(res, 404, { success: false, error: 'Module not found' });
        return;
      }
      json(res, 200, {
        success: true,
        data: { state, manifest, settings: readModuleSettings(moduleId) },
      });
      return;
    }

    if (req.method === 'GET' && action === '/status') {
      const state = getInstalledState(moduleId);
      let activeRunStatus: string | null = null;
      if (state?.pyorchScriptId) {
        activeRunStatus = await getModuleRunStatus(state.pyorchScriptId);
      }
      json(res, 200, {
        success: true,
        data: {
          state,
          settings: readModuleSettings(moduleId),
          snapshot: readModuleDataFile(moduleId, 'last_snapshot.json'),
          activeRunStatus,
          manifest: readLocalManifest(moduleId),
        },
      });
      return;
    }

    if (req.method === 'GET' && action === '/logs') {
      const state = getInstalledState(moduleId);
      if (!state?.pyorchScriptId) {
        json(res, 200, {
          success: true,
          data: { runId: null, runStatus: null, logs: [] },
        });
        return;
      }
      const query = req.url?.includes('?') ? new URL(req.url, 'http://modules-bridge').searchParams : null;
      const limit = Math.min(1000, Math.max(50, parseInt(query?.get('limit') || '300', 10) || 300));
      try {
        const data = await getModuleRunLogs(state.pyorchScriptId, limit);
        json(res, 200, { success: true, data });
      } catch (err) {
        json(res, 500, {
          success: false,
          error: err instanceof Error ? err.message : 'Logs failed',
        });
      }
      return;
    }

    if (req.method === 'GET' && action?.startsWith('/data/') && dataFile) {
      json(res, 200, { success: true, data: readModuleDataFile(moduleId, dataFile) });
      return;
    }

    if (req.method === 'GET' && action === '/settings') {
      const manifest = readLocalManifest(moduleId);
      json(res, 200, {
        success: true,
        data: { settings: readModuleSettings(moduleId), schema: manifest?.settingsSchema ?? [] },
      });
      return;
    }

    if (req.method === 'PUT' && action === '/settings') {
      try {
        const body = JSON.parse(await readBody(req)) as { settings?: Record<string, unknown> };
        if (!body.settings) {
          json(res, 400, { success: false, error: 'settings required' });
          return;
        }
        await saveModuleSettings(moduleId, body.settings);
        json(res, 200, { success: true, data: readModuleSettings(moduleId) });
      } catch (err) {
        json(res, 400, { success: false, error: err instanceof Error ? err.message : 'Save failed' });
      }
      return;
    }

    if (req.method === 'POST' && action === '/start') {
      try {
        const data = await startModule(moduleId);
        json(res, 200, { success: true, data });
      } catch (err) {
        json(res, 400, { success: false, error: err instanceof Error ? err.message : 'Start failed' });
      }
      return;
    }

    if (req.method === 'POST' && action === '/stop') {
      try {
        const data = await stopModule(moduleId);
        json(res, 200, { success: true, data });
      } catch (err) {
        json(res, 400, { success: false, error: err instanceof Error ? err.message : 'Stop failed' });
      }
      return;
    }

    if (req.method === 'POST' && action === '/update') {
      try {
        const data = await updateModule(moduleId);
        json(res, 200, { success: true, data });
      } catch (err) {
        json(res, 400, { success: false, error: err instanceof Error ? err.message : 'Update failed' });
      }
      return;
    }

    if (req.method === 'DELETE' && !action) {
      try {
        await uninstallModule(moduleId);
        json(res, 200, { success: true });
      } catch (err) {
        json(res, 400, { success: false, error: err instanceof Error ? err.message : 'Uninstall failed' });
      }
      return;
    }
  }

  json(res, 404, { success: false, error: 'Not found' });
}

const server = http.createServer((req, res) => {
  handleRequest(req, res).catch((err) => {
    logger.error({ err }, 'Request failed');
    json(res, 500, { success: false, error: 'Internal error' });
  });
});

server.listen(PORT, () => {
  logger.info({ port: PORT }, 'Modules bridge started');
});
