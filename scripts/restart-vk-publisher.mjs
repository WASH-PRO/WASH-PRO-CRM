#!/usr/bin/env node
/**
 * Перезапуск VK публикатора через modules-bridge API.
 * После обновления modules-bridge вызывает update (перерегистрация кода с env bootstrap).
 *
 *   API_URL=http://192.168.1.151 node scripts/restart-vk-publisher.mjs
 *   API_URL=http://192.168.1.151 WITH_UPDATE=1 node scripts/restart-vk-publisher.mjs
 */

const API_URL = (process.env.API_URL || 'http://localhost').replace(/\/$/, '');
const LOGIN = process.env.ADMIN_LOGIN || process.env.SERVICE_LOGIN || 'service';
const PASSWORD = process.env.ADMIN_PASSWORD || process.env.SERVICE_PASSWORD || 'ServiceInternal123!';
const WITH_UPDATE = process.env.WITH_UPDATE === '1';

async function login() {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: LOGIN, password: PASSWORD }),
  });
  const json = await res.json();
  if (!json.success || !json.data?.accessToken) {
    throw new Error(`Login failed: ${json.error || res.statusText}`);
  }
  return json.data.accessToken;
}

async function modulesApi(token, method, path, body) {
  const res = await fetch(`${API_URL}/api/crm/modules/installed/vk-publisher${path}`, {
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
  console.log(`API: ${API_URL}`);

  const statusBefore = await modulesApi(token, 'GET', '/status');
  console.log('Status before:', statusBefore.state?.status, 'run:', statusBefore.activeRunStatus);
  console.log('Settings:', JSON.stringify(statusBefore.settings, null, 2));

  if (WITH_UPDATE) {
    console.log('Updating module (re-register script with latest code)…');
    await modulesApi(token, 'POST', '/update');
  }

  console.log('Stopping…');
  await modulesApi(token, 'POST', '/stop');

  console.log('Starting…');
  const started = await modulesApi(token, 'POST', '/start');
  console.log('Started:', started.status);

  await new Promise((r) => setTimeout(r, 5000));

  const statusAfter = await modulesApi(token, 'GET', '/status');
  console.log('Status after:', statusAfter.state?.status, 'run:', statusAfter.activeRunStatus);
  console.log('Snapshot:', statusAfter.snapshot ? JSON.stringify(statusAfter.snapshot, null, 2) : '(null)');

  const logs = await modulesApi(token, 'GET', '/logs?limit=50');
  if (logs.logs?.length) {
    console.log('\nRecent logs:');
    for (const line of logs.logs.slice(-15)) {
      console.log(`  [${line.level || 'info'}] ${line.message || line.text || JSON.stringify(line)}`);
    }
  } else {
    console.log('\nNo logs yet (run may still be queued).');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
