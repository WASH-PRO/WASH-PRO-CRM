import { createReadStream } from 'node:fs';
import { mkdir, stat, unlink, writeFile } from 'node:fs/promises';
import http from 'node:http';
import { join, basename } from 'node:path';
import { gzipSync } from 'node:zlib';
import fetch from 'node-fetch';
import { pino } from 'pino';

const logger = pino({ level: 'info' });

const BACKUP_DIR = process.env.BACKUP_DIR || '/backups';
const ARCHIVE_DIR = join(BACKUP_DIR, 'archives');
const PORT = parseInt(process.env.BACKUP_HTTP_PORT || '3020', 10);
const API_URL = process.env.API_URL || 'http://dynamic-api:3001';

async function verifyToken(authHeader: string | undefined): Promise<boolean> {
  if (!authHeader?.startsWith('Bearer ')) return false;
  try {
    const res = await fetch(`${API_URL}/api/profile`, {
      headers: { Authorization: authHeader },
    });
    const json = (await res.json()) as { success?: boolean };
    return res.ok && json.success === true;
  } catch {
    return false;
  }
}

function safeBackupFilename(name: string): string | null {
  const base = basename(name);
  if (base !== name || base.includes('..')) return null;
  if (!/^wash-pro-crm-.+\.(archive\.gz|gz)$/.test(base)) return null;
  return base;
}

function safeArchiveFilename(name: string): string | null {
  const base = basename(name);
  if (base !== name || base.includes('..')) return null;
  if (!/^[\w-]+\.json(\.gz)?$/.test(base)) return null;
  return base;
}

async function readBody(req: http.IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

export function startBackupHttpServer(): void {
  const server = http.createServer(async (req, res) => {
    const url = req.url?.split('?')[0] ?? '';

    if (req.method === 'GET' && url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: true, service: 'wash-backup' }));
      return;
    }

    if (!(await verifyToken(req.headers.authorization))) {
      res.writeHead(401, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Unauthorized');
      return;
    }

    if (req.method === 'POST' && url === '/archives') {
      try {
        const raw = await readBody(req);
        const body = JSON.parse(raw) as {
          groupKey?: string;
          policyDays?: number;
          records?: unknown[];
        };
        const groupKey = body.groupKey || 'data';
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `${groupKey}-${timestamp}.json.gz`;
        await mkdir(ARCHIVE_DIR, { recursive: true });
        const payload = gzipSync(
          JSON.stringify({
            groupKey,
            policyDays: body.policyDays,
            createdAt: new Date().toISOString(),
            records: body.records ?? [],
          })
        );
        await writeFile(join(ARCHIVE_DIR, filename), payload);
        res.writeHead(201, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ filename }));
      } catch (err) {
        logger.error({ err }, 'Archive save failed');
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Archive save failed');
      }
      return;
    }

    const backupMatch = url.match(/^\/backups\/([^/]+)$/);
    if (backupMatch) {
      const filename = safeBackupFilename(decodeURIComponent(backupMatch[1]!));
      if (!filename) {
        res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Invalid filename');
        return;
      }
      const filepath = join(BACKUP_DIR, filename);

      if (req.method === 'GET') {
        try {
          const fileStat = await stat(filepath);
          res.writeHead(200, {
            'Content-Type': 'application/gzip',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Content-Length': fileStat.size,
          });
          createReadStream(filepath).pipe(res);
        } catch {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('File not found');
        }
        return;
      }

      if (req.method === 'DELETE') {
        try {
          await unlink(filepath);
          res.writeHead(204);
          res.end();
        } catch {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('File not found');
        }
        return;
      }
    }

    const archiveMatch = url.match(/^\/archives\/([^/]+)$/);
    if (archiveMatch) {
      const filename = safeArchiveFilename(decodeURIComponent(archiveMatch[1]!));
      if (!filename) {
        res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Invalid filename');
        return;
      }
      const filepath = join(ARCHIVE_DIR, filename);

      if (req.method === 'GET') {
        try {
          const fileStat = await stat(filepath);
          res.writeHead(200, {
            'Content-Type': 'application/gzip',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Content-Length': fileStat.size,
          });
          createReadStream(filepath).pipe(res);
        } catch {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('File not found');
        }
        return;
      }

      if (req.method === 'DELETE') {
        try {
          await unlink(filepath);
          res.writeHead(204);
          res.end();
        } catch {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('File not found');
        }
        return;
      }
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  });

  server.listen(PORT, () => {
    logger.info({ port: PORT }, 'Backup HTTP server started');
  });
}
