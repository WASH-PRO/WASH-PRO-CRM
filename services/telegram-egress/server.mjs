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
const CONNECT_TIMEOUT_MS = Number(process.env.TELEGRAM_CONNECT_TIMEOUT_MS || 8000);
const DEFAULT_IDLE_TIMEOUT_MS = Number(process.env.TELEGRAM_IDLE_TIMEOUT_MS || 90000);

function probeTelegram() {
  return new Promise((resolve) => {
    const started = Date.now();
    const req = https.request(
      {
        hostname: UPSTREAM_HOST,
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
          ms: Date.now() - started,
        });
      }
    );
    const t = setTimeout(() => {
      req.destroy();
      resolve({ ok: false, error: 'connect/timeout', ms: Date.now() - started });
    }, CONNECT_TIMEOUT_MS);
    req.on('error', (err) => {
      clearTimeout(t);
      resolve({ ok: false, error: String(err.message || err), ms: Date.now() - started });
    });
    req.on('close', () => clearTimeout(t));
    req.end();
  });
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
    let settled = false;
    const fail = (message) => {
      if (settled || res.headersSent) return;
      settled = true;
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, description: message }));
    };

    const upstream = https.request(
      {
        hostname: UPSTREAM_HOST,
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

    const overallTimer = setTimeout(() => {
      upstream.destroy();
      fail('Telegram upstream timeout');
    }, idleTimeoutMs);

    // Short timeout only until TCP+TLS connected; then allow long-poll idle.
    upstream.on('socket', (socket) => {
      socket.setTimeout(CONNECT_TIMEOUT_MS);
      socket.once('timeout', () => {
        if (!settled) {
          upstream.destroy();
          fail('Telegram connect timeout');
        }
      });
      const clearConnectTimeout = () => {
        socket.setTimeout(0);
      };
      socket.once('connect', clearConnectTimeout);
      socket.once('secureConnect', clearConnectTimeout);
    });

    upstream.on('error', (err) => {
      clearTimeout(overallTimer);
      fail(String(err.message || err));
    });

    if (body.length) upstream.write(body);
    upstream.end();
  });
}

const server = http.createServer(forward);
server.listen(PORT, BIND, () => {
  console.log(`wash-telegram-egress listening on ${BIND}:${PORT} → https://${UPSTREAM_HOST}`);
  probeTelegram().then((r) => {
    console.log(`telegram probe: ${JSON.stringify(r)}`);
  });
});
