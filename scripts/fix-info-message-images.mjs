#!/usr/bin/env node
/**
 * Replace blocked image hosts (picsum.photos) in CRM Publications with reachable placeholders.
 *
 * Usage:
 *   node scripts/fix-info-message-images.mjs
 *   DRY_RUN=1 node scripts/fix-info-message-images.mjs
 */

const API_URL = process.env.API_URL || 'http://localhost:3001';
const ADMIN_LOGIN = process.env.ADMIN_LOGIN || process.env.SERVICE_LOGIN || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || process.env.SERVICE_PASSWORD || 'Admin123!';
const DRY_RUN = process.env.DRY_RUN === '1';

const PLACEHOLDERS = [
  'https://placehold.co/800x450/0077ff/ffffff/png?text=Wash+Pro+1',
  'https://placehold.co/800x450/0066cc/ffffff/png?text=Wash+Pro+2',
  'https://placehold.co/800x450/0055aa/ffffff/png?text=Wash+Pro+3',
  'https://placehold.co/800x450/004488/ffffff/png?text=Wash+Pro+4',
  'https://placehold.co/800x450/003366/ffffff/png?text=Wash+Pro+5',
];

const BLOCKED_HOSTS = ['picsum.photos'];

function mapPicsum(url) {
  const match = url.match(/washpro(\d)/i);
  const index = match ? Math.max(0, Number(match[1]) - 1) : 0;
  return PLACEHOLDERS[index % PLACEHOLDERS.length];
}

function shouldReplace(url) {
  if (!url || typeof url !== 'string') return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return BLOCKED_HOSTS.some((blocked) => host === blocked || host.endsWith(`.${blocked}`));
  } catch {
    return false;
  }
}

async function login() {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: ADMIN_LOGIN, password: ADMIN_PASSWORD }),
  });
  const json = await res.json();
  if (!json.success || !json.data?.accessToken) {
    throw new Error(`Login failed: ${json.error || res.statusText}`);
  }
  return json.data.accessToken;
}

async function api(token, method, path, body) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!json.success) {
    throw new Error(`${method} ${path}: ${json.error || res.statusText}`);
  }
  return json.data;
}

async function main() {
  const token = await login();
  const rows = await api(token, 'GET', '/api/crm/info-messages?limit=500');
  const toFix = rows.filter((row) => shouldReplace(row.imageUrl));

  console.log(`API: ${API_URL}`);
  console.log(`Publications with blocked image URLs: ${toFix.length}`);
  if (toFix.length === 0) {
    console.log('Nothing to update.');
    return;
  }

  let updated = 0;
  for (const row of toFix) {
    const nextUrl = mapPicsum(row.imageUrl);
    console.log(`  ${row.id}: ${row.imageUrl} -> ${nextUrl}`);
    if (!DRY_RUN) {
      await api(token, 'PUT', `/api/crm/info-messages/${row.id}`, {
        ...row,
        imageUrl: nextUrl,
        updatedAt: new Date().toISOString(),
      });
      updated += 1;
    }
  }

  console.log(DRY_RUN ? 'Dry run complete.' : `Updated ${updated} publication(s).`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
