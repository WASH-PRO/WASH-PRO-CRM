#!/usr/bin/env node
/**
 * Host-network Telegram API egress proxy.
 * Docker bridge NAT on some hosts cannot reach api.telegram.org; this process
 * uses the host stack and forwards /bot… paths upstream over HTTPS.
 */
import http from 'node:http';
import https from 'node:https';
import dns from 'node:dns';

dns.setDefaultResultOrder('ipv4first');

const PORT = Number(process.env.TELEGRAM_EGRESS_PORT || 3987);
const BIND = process.env.TELEGRAM_EGRESS_BIND || '0.0.0.0';
const UPSTREAM_HOST = 'api.telegram.org';
/** Fail fast when VPN/firewall blocks Telegram (SYN hang). */
const CONNECT_TIMEOUT_MS = Number(process.env.TELEGRAM_CONNECT_TIMEOUT_MS || 4000);
const DEFAULT_IDLE_TIMEOUT_MS = Number(process.env.TELEGRAM_IDLE_TIMEOUT_MS || 90000);
/** Try alternate Bot API edges when the resolved A-record is filtered. */
const FALLBACK_IPS = (process.env.TELEGRAM_FALLBACK_IPS ||
  '149.154.167.50,149.154.167.220,149.154.166.120,149.154.167.99')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function httpsProbeTo(hostOrIp) {
  return new Promise((resolve) => {
    const started = Date.now();
    const req = https.request(
      {
        host: hostOrIp,
        port: 443,
        path: '/',
        method: 'HEAD',
        family: 4,
        servername: UPSTREAM_HOST,
        headers: { Host: UPSTREAM_HOST, 'User-Agent': 'wash-telegram-egress/1.1' },
      },
      (up) => {
        up.resume();
        resolve({
          ok: (up.statusCode || 0) >= 200 && (up.statusCode || 0) < 500,
          status: up.statusCode || 0,
          via: hostOrIp,
          ms: Date.now() - started,
        });
      }
    );
    const t = setTimeout(() => {
      req.destroy();
      resolve({ ok: false, error: 'connect/timeout', via: hostOrIp, ms: Date.now() - started });
    }, CONNECT_TIMEOUT_MS);
    req.on('error', (err) => {
      clearTimeout(t);
      resolve({
        ok: false,
        error: String(err.message || err),
        via: hostOrIp,
        ms: Date.now() - started,
      });
    });
    req.on('close', () => clearTimeout(t));
    req.end();
  });
}

async function probeTelegram() {
  const primary = await httpsProbeTo(UPSTREAM_HOST);
  if (primary.ok) return primary;
  for (const ip of FALLBACK_IPS) {
    const next = await httpsProbeTo(ip);
    if (next.ok) return next;
  }
  return primary;
}

function forward(req, res) {
  const path = req.url || '/';
  if (path === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
    return;
  }
  if (path === '/health/telegram') {
    probeTelegram().then((result) => {
      const code = result.ok ? 200 : 503;
      res.writeHead(code, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    });
    return;
  }
  if (!path.startsWith('/bot')) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('not found');
    return;
  }

  const idleTimeoutMs = Math.max(
    CONNECT_TIMEOUT_MS,
    Number(req.headers['x-telegram-timeout-ms']) || DEFAULT_IDLE_TIMEOUT_MS
  );

  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    const body = Buffer.concat(chunks);
    const targets = [UPSTREAM_HOST, ...FALLBACK_IPS];
    let targetIndex = 0;
    let settled = false;

    const fail = (message) => {
      if (settled || res.headersSent) return;
      settled = true;
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, description: message }));
    };

    const tryNext = () => {
      if (settled) return;
      if (targetIndex >= targets.length) {
        fail('Telegram connect timeout');
        return;
      }
      const target = targets[targetIndex++];
      let overallTimer;

      const upstream = https.request(
        {
          host: target,
          port: 443,
          path,
          method: req.method || 'GET',
          family: 4,
          servername: UPSTREAM_HOST,
          headers: {
            Host: UPSTREAM_HOST,
            'Content-Type': req.headers['content-type'] || 'application/json',
            'Content-Length': body.length,
            'User-Agent': 'wash-telegram-egress/1.1',
          },
        },
        (up) => {
          settled = true;
          clearTimeout(overallTimer);
          const out = [];
          up.on('data', (c) => out.push(c));
          up.on('end', () => {
            const buf = Buffer.concat(out);
            res.writeHead(up.statusCode || 502, {
              'Content-Type': up.headers['content-type'] || 'application/json',
              'Content-Length': buf.length,
            });
            res.end(buf);
          });
        }
      );

      overallTimer = setTimeout(() => {
        upstream.destroy();
        if (!settled) tryNext();
      }, targetIndex === 1 ? CONNECT_TIMEOUT_MS : idleTimeoutMs);

      upstream.on('socket', (socket) => {
        socket.setTimeout(CONNECT_TIMEOUT_MS);
        socket.once('timeout', () => {
          if (!settled) {
            upstream.destroy();
            tryNext();
          }
        });
        const clearConnectTimeout = () => socket.setTimeout(0);
        socket.once('connect', clearConnectTimeout);
        socket.once('secureConnect', () => {
          clearConnectTimeout();
          // Connected: allow long-poll for the remainder of idleTimeoutMs.
          clearTimeout(overallTimer);
          overallTimer = setTimeout(() => {
            upstream.destroy();
            fail('Telegram upstream timeout');
          }, idleTimeoutMs);
        });
      });

      upstream.on('error', () => {
        clearTimeout(overallTimer);
        if (!settled) tryNext();
      });

      if (body.length) upstream.write(body);
      upstream.end();
    };

    tryNext();
  });
}

const server = http.createServer(forward);
server.listen(PORT, BIND, () => {
  console.log(`wash-telegram-egress listening on ${BIND}:${PORT} → https://${UPSTREAM_HOST}`);
  probeTelegram().then((r) => {
    console.log(`telegram probe: ${JSON.stringify(r)}`);
  });
});
