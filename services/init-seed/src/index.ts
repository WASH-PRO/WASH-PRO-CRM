import fetch from 'node-fetch';
import {
  CRM_ENDPOINTS,
  CRM_GROUPS,
  DEFAULT_CURRENCIES,
  DEFAULT_DISCOUNT_TYPES,
  DEFAULT_WORK_MODES,
  DEFAULT_DEMO_WASH,
  DEFAULT_DEMO_POSTS,
  DEFAULT_SETTINGS,
  ENDPOINT_GROUPS,
  LEGACY_ENDPOINT_GROUP,
  type EndpointHandler,
  type SchemaField,
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
      email: 'service@wash-pro-crm.internal',
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
    return groupsWithAnyPermission(allGroups, 'manage_api', 'delete', 'update');
  }
  const dynamic = groupsWithAnyPermission(allGroups, 'update', 'delete', 'manage_api', 'manage_users');
  const named = groupIdsByNames(allGroups, SYSTEM_WRITE_GROUPS);
  return [...new Set([...named, ...dynamic])];
}

function resolveSchemaFields(
  fields: SchemaField[],
  endpointList: Array<{ _id: string; slug?: string }>
): Array<{
  name: string;
  type: string;
  required?: boolean;
  order?: number;
  description?: string;
  refEndpointId?: string;
}> {
  return fields.map((f) => {
    if (f.type === 'reference' && f.refEndpointSlug) {
      const ref = endpointList.find((e) => e.slug === f.refEndpointSlug);
      if (!ref) {
        return {
          name: f.name,
          type: f.type,
          required: f.required,
          order: f.order,
          description: f.description,
        };
      }
      return {
        name: f.name,
        type: 'reference',
        required: f.required,
        order: f.order,
        description: f.description,
        refEndpointId: ref._id,
      };
    }
    return {
      name: f.name,
      type: f.type,
      required: f.required,
      order: f.order,
      description: f.description,
    };
  });
}

function schemaEquals(
  a: Array<{ name: string; type: string; required?: boolean; order?: number; refEndpointId?: string }> | undefined,
  b: SchemaField[],
  endpointList: Array<{ _id: string; slug?: string }>
): boolean {
  const norm = (fields: Array<{ name: string; type: string; required?: boolean; order?: number; refEndpointId?: string }>) =>
    JSON.stringify(
      [...fields]
        .map((f) => ({
          name: f.name,
          type: f.type,
          required: !!f.required,
          order: f.order ?? 0,
          refEndpointId: f.refEndpointId || undefined,
        }))
        .sort((x, y) => x.order - y.order || x.name.localeCompare(y.name))
    );
  return norm(a || []) === norm(resolveSchemaFields(b, endpointList));
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

function handlersNeedUpdate(
  current: Array<{ name?: string; type?: string; code?: string; enabled?: boolean }> | undefined,
  expected: EndpointHandler[] | undefined
): boolean {
  if (!expected?.length) return false;
  const exp = expected[0]!;
  const cur = current?.find((h) => h.type === 'javascript');
  if (!cur) return true;
  return cur.code !== exp.code || cur.enabled !== exp.enabled || cur.name !== exp.name;
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
      handlers?: Array<{ name?: string; type?: string; code?: string; enabled?: boolean }>;
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
  let handlersFixed = 0;

  for (const ep of CRM_ENDPOINTS) {
    const groupId = endpointGroupIds[ep.groupKey];
    if (!groupId) {
      throw new Error(`Missing endpoint group for key: ${ep.groupKey}`);
    }

    const found = list.find((e) => e.path === ep.path && e.method === ep.method);
    const allowedGroupIds =
      ep.accessType === 'group' ? allowedGroupsForEndpoint(ep, allGroups) : defaultAllowed;

    if (!found) {
      const createdRes = await api<{ _id: string; slug?: string }>(token, 'POST', '/api/endpoints', {
        name: ep.name,
        description: ep.description,
        slug: ep.slug,
        path: ep.path,
        method: ep.method,
        groupId,
        schema: resolveSchemaFields(ep.schema, list),
        accessType: ep.accessType,
        allowedGroupIds: ep.accessType === 'group' ? allowedGroupIds : defaultAllowed,
        enabled: true,
        ...(ep.handlers ? { handlers: ep.handlers } : {}),
      });
      if (createdRes?._id) {
        list.push({ _id: createdRes._id, slug: ep.slug, path: ep.path, method: ep.method });
      }
      console.log(`  Created endpoint: ${ep.method} ${ep.path} → ${ep.groupKey}`);
      created++;
      continue;
    }

    const patch: Record<string, unknown> = {};
    if (found.groupId !== groupId) patch.groupId = groupId;
    if (ep.accessType === 'group' && !sameIdSets(found.allowedGroupIds, allowedGroupIds)) {
      patch.allowedGroupIds = allowedGroupIds;
    }
    if (ep.schema.length > 0 && !schemaEquals(found.fields, ep.schema, list)) {
      patch.schema = resolveSchemaFields(ep.schema, list);
    }
    if (ep.handlers && handlersNeedUpdate(found.handlers, ep.handlers)) {
      patch.handlers = ep.handlers;
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
      if (patch.handlers) {
        console.log(`  Updated handler: ${ep.method} ${ep.path}`);
        handlersFixed++;
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
    else if (item.path.includes('/currencies')) groupKey = 'currencies';
    else if (item.path.includes('discount-types')) groupKey = 'discount-types';
    else if (item.path.includes('work-modes')) groupKey = 'work-modes';
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

  if (created === 0 && reorganized === 0 && accessFixed === 0 && schemaFixed === 0 && handlersFixed === 0) {
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

async function ensureDefaultCurrencies(token: string): Promise<void> {
  let existing: Array<{ id: string; code: string }> = [];
  try {
    const res = await fetch(`${API_URL}/api/crm/currencies`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 404) return;
    const json = (await res.json()) as ApiResponse<Array<{ id: string; code: string }>>;
    if (json.success && json.data) {
      existing = json.data;
    }
  } catch {
    console.log('  CRM currencies endpoint not ready yet, skipping currencies');
    return;
  }

  for (const currency of DEFAULT_CURRENCIES) {
    const found = existing.find((e) => e.code === currency.code);
    if (!found) {
      const res = await fetch(`${API_URL}/api/crm/currencies`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(currency),
      });
      if (!res.ok) {
        const err = (await res.json()) as ApiResponse;
        throw new Error(`Failed to create currency ${currency.code}: ${err.error}`);
      }
      console.log(`  Created default currency: ${currency.code} (${currency.name})`);
    }
  }
}

async function ensureDefaultDiscountTypes(token: string): Promise<void> {
  let existing: Array<{ id: string; code: string; name: string; status?: string }> = [];
  try {
    const res = await fetch(`${API_URL}/api/crm/discount-types`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 404) return;
    const json = (await res.json()) as ApiResponse<Array<{ id: string; code: string; name: string; status?: string }>>;
    if (json.success && json.data) {
      existing = json.data;
    }
  } catch {
    console.log('  CRM discount-types endpoint not ready yet, skipping discount types');
    return;
  }

  for (const item of DEFAULT_DISCOUNT_TYPES) {
    const found = existing.find((e) => String(e.code).toUpperCase() === item.code.toUpperCase());
    if (!found) {
      const res = await fetch(`${API_URL}/api/crm/discount-types`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(item),
      });
      if (!res.ok) {
        const err = (await res.json()) as ApiResponse;
        throw new Error(`Failed to create discount type ${item.code}: ${err.error}`);
      }
      console.log(`  Created default discount type: ${item.code} (${item.name})`);
    } else if (!found.status) {
      const res = await fetch(`${API_URL}/api/crm/discount-types/${found.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ code: found.code, name: found.name, status: 'active' }),
      });
      if (!res.ok) {
        const err = (await res.json()) as ApiResponse;
        throw new Error(`Failed to update discount type ${found.code}: ${err.error}`);
      }
      console.log(`  Set default status for discount type: ${found.code}`);
    }
  }
}

async function ensureDefaultWorkModes(token: string): Promise<void> {
  let existing: Array<{ id: string; code: string; name: string; modeType?: string; status?: string }> = [];
  try {
    const res = await fetch(`${API_URL}/api/crm/work-modes`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 404) return;
    const json = (await res.json()) as ApiResponse<
      Array<{ id: string; code: string; name: string; modeType?: string; status?: string }>
    >;
    if (json.success && json.data) {
      existing = json.data;
    }
  } catch {
    console.log('  CRM work-modes endpoint not ready yet, skipping work modes');
    return;
  }

  for (const item of DEFAULT_WORK_MODES) {
    const found = existing.find((e) => String(e.code).toUpperCase() === item.code.toUpperCase());
    if (!found) {
      const res = await fetch(`${API_URL}/api/crm/work-modes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(item),
      });
      if (!res.ok) {
        const err = (await res.json()) as ApiResponse;
        throw new Error(`Failed to create work mode ${item.code}: ${err.error}`);
      }
      console.log(`  Created default work mode: ${item.code} (${item.name})`);
    } else if (!found.status || !found.modeType) {
      const res = await fetch(`${API_URL}/api/crm/work-modes/${found.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          code: found.code,
          name: found.name,
          modeType: found.modeType || item.modeType || 'system',
          status: found.status || 'active',
        }),
      });
      if (!res.ok) {
        const err = (await res.json()) as ApiResponse;
        throw new Error(`Failed to update work mode ${found.code}: ${err.error}`);
      }
      console.log(`  Patched default fields for work mode: ${found.code}`);
    }
  }
}

async function ensureDemoSite(token: string): Promise<void> {
  let washes: Array<{ id: string }> = [];
  try {
    const res = await fetch(`${API_URL}/api/crm/washes?limit=1`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 404) return;
    const json = (await res.json()) as ApiResponse<Array<{ id: string }>>;
    if (json.success && json.data) washes = json.data;
  } catch {
    console.log('  CRM washes endpoint not ready yet, skipping demo site');
    return;
  }

  if (washes.length > 0) {
    console.log('  Demo site skipped: washes already exist');
    return;
  }

  const washRes = await fetch(`${API_URL}/api/crm/washes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      ...DEFAULT_DEMO_WASH,
      registeredAt: new Date().toISOString(),
    }),
  });
  const washJson = (await washRes.json()) as ApiResponse<{ id: string }>;
  if (!washRes.ok || !washJson.success || !washJson.data?.id) {
    throw new Error(`Failed to create demo wash: ${washJson.error || washRes.statusText}`);
  }
  const washId = washJson.data.id;
  console.log(`  Created demo wash: ${DEFAULT_DEMO_WASH.name}`);

  for (const post of DEFAULT_DEMO_POSTS) {
    const postRes = await fetch(`${API_URL}/api/crm/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ washId, ...post }),
    });
    const postJson = (await postRes.json()) as ApiResponse<{ id: string }>;
    if (!postRes.ok || !postJson.success) {
      throw new Error(`Failed to create demo post ${post.serialNumber}: ${postJson.error || postRes.statusText}`);
    }
    console.log(`  Created demo post: ${post.serialNumber}`);
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
  console.log('WASH PRO CRM Init Seed — starting...');
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
  await ensureDefaultCurrencies(token);
  await ensureDefaultDiscountTypes(token);
  await ensureDefaultWorkModes(token);
  await ensureDemoSite(token);
  await verifyServiceLogin();

  console.log('WASH PRO CRM Init Seed — complete (exit 0 is normal for this one-shot container)');
}

main().catch((err) => {
  console.error('Init seed FAILED:', err);
  process.exit(1);
});
