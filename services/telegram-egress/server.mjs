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

function forward(req, res) {
  const path = req.url || '/';
  if (!path.startsWith('/bot') && path !== '/health') {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('not found');
    return;
  }
  if (path === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
    return;
  }

  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    const body = Buffer.concat(chunks);
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
          'User-Agent': 'wash-telegram-egress/1.0',
        },
        timeout: 90000,
      },
      (up) => {
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
    upstream.on('timeout', () => {
      upstream.destroy();
      if (!res.headersSent) {
        res.writeHead(504, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, description: 'Telegram upstream timeout' }));
      }
    });
    upstream.on('error', (err) => {
      if (!res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, description: String(err.message || err) }));
      }
    });
    if (body.length) upstream.write(body);
    upstream.end();
  });
}

const server = http.createServer(forward);
server.listen(PORT, BIND, () => {
  console.log(`wash-telegram-egress listening on ${BIND}:${PORT} → https://${UPSTREAM_HOST}`);
});
