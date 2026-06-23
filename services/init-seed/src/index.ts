import fetch from 'node-fetch';
import {
  CRM_ENDPOINTS,
  CRM_GROUPS,
  DEFAULT_SETTINGS,
  ENDPOINT_GROUPS,
  LEGACY_ENDPOINT_GROUP,
} from './endpoints.js';

const API_URL = process.env.API_URL || 'http://dynamic-api:3001';
const ADMIN_LOGIN = process.env.ADMIN_LOGIN || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin123!';
const SERVICE_LOGIN = process.env.SERVICE_LOGIN || 'service';
const SERVICE_PASSWORD = process.env.SERVICE_PASSWORD || 'ServiceInternal123!';

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Ждём не только /health, но и готовность admin-логина (после seed БД). */
async function waitForApiReady(maxAttempts = 60): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const health = await fetch(`${API_URL}/api/health`);
      if (!health.ok) {
        await sleep(2000);
        continue;
      }

      const loginRes = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login: ADMIN_LOGIN, password: ADMIN_PASSWORD }),
      });
      const loginJson = (await loginRes.json()) as ApiResponse<{ accessToken: string }>;
      if (loginJson.success && loginJson.data?.accessToken) {
        console.log(`  API ready (attempt ${i + 1})`);
        return;
      }
    } catch {
      // retry
    }
    if (i % 5 === 0) {
      console.log(`  Waiting for Dynamic API... (${i + 1}/${maxAttempts})`);
    }
    await sleep(2000);
  }
  throw new Error('Dynamic API not ready: admin login unavailable');
}

async function login(loginName: string, password: string, retries = 5): Promise<string> {
  let lastError = 'unknown';
  for (let i = 0; i < retries; i++) {
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login: loginName, password }),
    });
    const json = (await res.json()) as ApiResponse<{ accessToken: string }>;
    if (json.success && json.data?.accessToken) {
      return json.data.accessToken;
    }
    lastError = json.error || res.statusText;
    await sleep(1500);
  }
  throw new Error(`Login failed for ${loginName}: ${lastError}`);
}

async function api<T>(
  token: string,
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = (await res.json()) as ApiResponse<T>;
  if (!json.success) {
    throw new Error(`${method} ${path}: ${json.error || res.statusText}`);
  }
  return json.data as T;
}

async function ensureCrmGroups(token: string): Promise<Record<string, string>> {
  const groupsList = await api<Array<{ _id: string; name: string }>>(token, 'GET', '/api/groups');
  const groupMap: Record<string, string> = {};

  for (const g of groupsList) {
    groupMap[g.name] = g._id;
  }

  for (const groupDef of CRM_GROUPS) {
    if (!groupMap[groupDef.name]) {
      const created = await api<{ _id: string; name: string }>(token, 'POST', '/api/groups', {
        name: groupDef.name,
        description: groupDef.description,
        permissions: groupDef.permissions,
      });
      groupMap[created.name] = created._id;
      console.log(`  Created CRM group: ${groupDef.name}`);
    }
  }

  if (!groupMap.Service) {
    throw new Error('Service RBAC group missing after ensureCrmGroups');
  }
  return groupMap;
}

async function ensureServiceUser(token: string, serviceGroupId: string): Promise<void> {
  const usersPage = await api<{ data: Array<{ login: string }> }>(token, 'GET', '/api/users?limit=100');
  const list = Array.isArray(usersPage) ? usersPage : usersPage.data || [];
  const exists = list.some((u) => u.login === SERVICE_LOGIN);

  if (!exists) {
    await api(token, 'POST', '/api/users', {
      login: SERVICE_LOGIN,
      email: 'service@wash-crm.internal',
      password: SERVICE_PASSWORD,
      name: 'Internal Service Account',
      status: 'active',
      groupIds: [serviceGroupId],
    });
    console.log(`  Created service account: ${SERVICE_LOGIN}`);
    await sleep(1000);
  } else {
    console.log(`  Service account exists: ${SERVICE_LOGIN}`);
  }
}

async function ensureEndpointGroups(token: string): Promise<Record<string, string>> {
  const existing = await api<Array<{ _id: string; name: string }>>(token, 'GET', '/api/endpoints/groups');
  const byName = new Map(existing.map((g) => [g.name, g._id]));
  const groupIds: Record<string, string> = {};

  for (const def of ENDPOINT_GROUPS) {
    const found = byName.get(def.name);
    if (found) {
      groupIds[def.key] = found;
      continue;
    }
    const created = await api<{ _id: string; name: string }>(token, 'POST', '/api/endpoints/groups', {
      name: def.name,
      description: def.description,
      icon: def.icon,
      color: def.color,
      order: def.order,
    });
    groupIds[def.key] = created._id;
    byName.set(def.name, created._id);
    console.log(`  Created endpoint group: ${def.name}`);
  }

  return groupIds;
}

async function removeLegacyEndpointGroup(token: string): Promise<void> {
  const groups = await api<Array<{ _id: string; name: string }>>(token, 'GET', '/api/endpoints/groups');
  const legacy = groups.find((g) => g.name === LEGACY_ENDPOINT_GROUP);
  if (!legacy) return;

  const endpoints = await api<{ data: Array<{ _id: string; groupId?: string }> }>(
    token,
    'GET',
    '/api/endpoints?limit=200'
  );
  const stillInLegacy = (endpoints.data || []).some(
    (ep) => ep.groupId === legacy._id
  );
  if (stillInLegacy) return;

  try {
    await api(token, 'DELETE', `/api/endpoints/groups/${legacy._id}`);
    console.log(`  Removed legacy group: ${LEGACY_ENDPOINT_GROUP}`);
  } catch {
    // group may be in use or system-protected
  }
}

interface GroupInfo {
  _id: string;
  name: string;
  permissions?: string[];
}

const SYSTEM_WRITE_GROUPS = ['Super Admin', 'Admin', 'Administrator', 'Operator', 'Service', 'Editor', 'Manager'];
const SYSTEM_SERVICE_GROUPS = ['Super Admin', 'Admin', 'Administrator', 'Service'];

function groupIdsByNames(allGroups: GroupInfo[], names: string[]): string[] {
  const unique = new Set<string>();
  for (const name of names) {
    const g = allGroups.find((x) => x.name === name);
    if (g) unique.add(g._id);
  }
  return [...unique];
}

function groupsWithAnyPermission(allGroups: GroupInfo[], ...perms: string[]): string[] {
  const ids = new Set<string>();
  for (const g of allGroups) {
    if (perms.some((p) => g.permissions?.includes(p))) {
      ids.add(g._id);
    }
  }
  return [...ids];
}

function sameIdSets(a: string[] = [], b: string[] = []): boolean {
  const sa = [...a].map(String).sort().join(',');
  const sb = [...b].map(String).sort().join(',');
  return sa === sb;
}

function allowedGroupsForEndpoint(
  ep: (typeof CRM_ENDPOINTS)[number],
  allGroups: GroupInfo[]
): string[] {
  const restricted = ep.groupKey === 'telemetry' || ep.groupKey === 'backup';
  if (restricted) {
    return groupsWithAnyPermission(allGroups, 'manage_api', 'delete');
  }
  const dynamic = groupsWithAnyPermission(allGroups, 'update', 'delete', 'manage_api', 'manage_users');
  const named = groupIdsByNames(allGroups, SYSTEM_WRITE_GROUPS);
  return [...new Set([...named, ...dynamic])];
}

function schemaEquals(
  a: Array<{ name: string; type: string; required?: boolean; order?: number }> | undefined,
  b: Array<{ name: string; type: string; required?: boolean; order?: number }>
): boolean {
  const norm = (fields: typeof b) =>
    JSON.stringify(
      [...fields]
        .map((f) => ({ name: f.name, type: f.type, required: !!f.required, order: f.order ?? 0 }))
        .sort((x, y) => x.order - y.order || x.name.localeCompare(y.name))
    );
  return norm(a || []) === norm(b);
}

function normalizeGroupIds(groupIds: unknown[]): string[] {
  return groupIds.map((id) => {
    if (typeof id === 'object' && id !== null && '_id' in id) {
      return String((id as { _id: string })._id);
    }
    return String(id);
  });
}

async function ensureDefaultAdminMembership(
  token: string,
  allGroups: GroupInfo[]
): Promise<void> {
  const requiredIds = groupIdsByNames(allGroups, ['Super Admin', 'Admin', 'Administrator']);
  if (requiredIds.length === 0) return;

  const usersPage = await api<{ data: Array<{ _id: string; login: string; groupIds: unknown[] }> }>(
    token,
    'GET',
    '/api/users?limit=100'
  );
  const list = Array.isArray(usersPage) ? usersPage : usersPage.data || [];
  const adminUser = list.find((u) => u.login === ADMIN_LOGIN);
  if (!adminUser) return;

  const currentIds = normalizeGroupIds(adminUser.groupIds);
  const groupIds = [...new Set([...currentIds, ...requiredIds])];
  if (groupIds.length === currentIds.length) return;

  await api(token, 'PUT', `/api/users/${adminUser._id}`, { groupIds });
  console.log(`  Ensured admin groups for: ${ADMIN_LOGIN}`);
}

async function ensureEndpoints(
  token: string,
  endpointGroupIds: Record<string, string>,
  allGroups: GroupInfo[]
): Promise<void> {
  const existingRes = await api<{
    data: Array<{
      _id: string;
      path: string;
      method: string;
      groupId?: string;
      slug?: string;
      allowedGroupIds?: string[];
      accessType?: string;
      fields?: Array<{ name: string; type: string; required?: boolean; order?: number }>;
    }>;
  }>(token, 'GET', '/api/endpoints?limit=200');
  const list = existingRes.data || [];

  const defByKey = new Map(
    CRM_ENDPOINTS.map((ep) => [`${ep.method}:${ep.path}`, ep])
  );

  const defaultAllowed = groupIdsByNames(allGroups, SYSTEM_WRITE_GROUPS);

  let created = 0;
  let reorganized = 0;
  let accessFixed = 0;
  let schemaFixed = 0;

  for (const ep of CRM_ENDPOINTS) {
    const groupId = endpointGroupIds[ep.groupKey];
    if (!groupId) {
      throw new Error(`Missing endpoint group for key: ${ep.groupKey}`);
    }

    const found = list.find((e) => e.path === ep.path && e.method === ep.method);
    const allowedGroupIds =
      ep.accessType === 'group' ? allowedGroupsForEndpoint(ep, allGroups) : defaultAllowed;

    if (!found) {
      await api(token, 'POST', '/api/endpoints', {
        name: ep.name,
        description: ep.description,
        slug: ep.slug,
        path: ep.path,
        method: ep.method,
        groupId,
        schema: ep.schema,
        accessType: ep.accessType,
        allowedGroupIds: ep.accessType === 'group' ? allowedGroupIds : defaultAllowed,
        enabled: true,
      });
      console.log(`  Created endpoint: ${ep.method} ${ep.path} → ${ep.groupKey}`);
      created++;
      continue;
    }

    const patch: Record<string, unknown> = {};
    if (found.groupId !== groupId) patch.groupId = groupId;
    if (ep.accessType === 'group' && !sameIdSets(found.allowedGroupIds, allowedGroupIds)) {
      patch.allowedGroupIds = allowedGroupIds;
    }
    if (ep.schema.length > 0 && !schemaEquals(found.fields, ep.schema)) {
      patch.schema = ep.schema;
    }

    if (Object.keys(patch).length > 0) {
      await api(token, 'PUT', `/api/endpoints/${found._id}`, patch);
      if (patch.groupId) {
        console.log(`  Moved endpoint: ${ep.method} ${ep.path} → ${ep.groupKey}`);
        reorganized++;
      }
      if (patch.allowedGroupIds) {
        accessFixed++;
      }
      if (patch.schema) {
        console.log(`  Updated schema: ${ep.method} ${ep.path}`);
        schemaFixed++;
      }
    }
  }

  // Перенос CRM endpoints без точного совпадения (по префиксу пути)
  for (const item of list) {
    if (!item.path.startsWith('/api/crm/')) continue;
    const def = defByKey.get(`${item.method}:${item.path}`);
    if (def) continue;

    const slugPrefix = item.slug || item.path;
    let groupKey: string | undefined;
    if (slugPrefix.includes('wash') || item.path.includes('/washes')) groupKey = 'washes';
    else if (item.path.includes('/posts') && !item.path.includes('post-states')) groupKey = 'posts';
    else if (item.path.includes('post-states')) groupKey = 'scada';
    else if (item.path.includes('/cards')) groupKey = 'cards';
    else if (item.path.includes('usage-stats') || item.path.includes('finance-stats')) groupKey = 'statistics';
    else if (item.path.includes('/settings')) groupKey = 'settings';
    else if (item.path.includes('/notifications')) groupKey = 'notifications';
    else if (item.path.includes('/backups') || item.path.includes('archive-logs')) groupKey = 'backup';
    else if (item.path.includes('/telemetry')) groupKey = 'telemetry';

    if (!groupKey) continue;
    const targetGroupId = endpointGroupIds[groupKey];
    if (targetGroupId && item.groupId !== targetGroupId) {
      await api(token, 'PUT', `/api/endpoints/${item._id}`, { groupId: targetGroupId });
      reorganized++;
    }
  }

  if (created === 0 && reorganized === 0 && accessFixed === 0 && schemaFixed === 0) {
    console.log(`  All ${CRM_ENDPOINTS.length} CRM endpoints configured`);
  } else if (schemaFixed > 0) {
    console.log(`  Updated schema on ${schemaFixed} endpoint(s)`);
  } else if (accessFixed > 0) {
    console.log(`  Updated access on ${accessFixed} endpoint(s)`);
  } else if (reorganized > 0) {
    console.log(`  Reorganized ${reorganized} endpoint(s) into groups`);
  }
}

async function ensureDefaultSettings(token: string): Promise<void> {
  let existing: Array<{ id: string; key: string }> = [];
  try {
    const res = await fetch(`${API_URL}/api/crm/settings`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 404) return;
    const json = (await res.json()) as ApiResponse<Array<{ id: string; key: string }>>;
    if (json.success && json.data) {
      existing = json.data;
    }
  } catch {
    console.log('  CRM settings endpoint not ready yet, skipping settings');
    return;
  }

  for (const setting of DEFAULT_SETTINGS) {
    const found = existing.find((e) => e.key === setting.key);
    if (!found) {
      const res = await fetch(`${API_URL}/api/crm/settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(setting),
      });
      if (!res.ok) {
        const err = (await res.json()) as ApiResponse;
        throw new Error(`Failed to create setting ${setting.key}: ${err.error}`);
      }
      console.log(`  Created default setting: ${setting.key}`);
    }
  }
}

async function verifyServiceLogin(): Promise<void> {
  try {
    await login(SERVICE_LOGIN, SERVICE_PASSWORD, 3);
    console.log(`  Service login OK: ${SERVICE_LOGIN}`);
  } catch (err) {
    console.warn(`  Service login check skipped: ${err instanceof Error ? err.message : err}`);
  }
}

async function main(): Promise<void> {
  console.log('WASH CRM Init Seed — starting...');
  await waitForApiReady();

  const token = await login(ADMIN_LOGIN, ADMIN_PASSWORD);
  console.log(`  Admin login OK: ${ADMIN_LOGIN}`);

  const rbacGroups = await ensureCrmGroups(token);
  const allGroups = await api<GroupInfo[]>(token, 'GET', '/api/groups');
  await ensureDefaultAdminMembership(token, allGroups);
  await ensureServiceUser(token, rbacGroups.Service);
  const endpointGroupIds = await ensureEndpointGroups(token);
  await ensureEndpoints(token, endpointGroupIds, allGroups);
  await removeLegacyEndpointGroup(token);
  await ensureDefaultSettings(token);
  await verifyServiceLogin();

  console.log('WASH CRM Init Seed — complete (exit 0 is normal for this one-shot container)');
}

main().catch((err) => {
  console.error('Init seed FAILED:', err);
  process.exit(1);
});
