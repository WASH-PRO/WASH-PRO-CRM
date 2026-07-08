import {
  endpointRepository,
  endpointGroupRepository,
  endpointDataRepository,
  logRepository,
} from '../repositories';
import {
  normalizePath,
  validateDataAgainstSchema,
  validateReferences,
  applyDefaults,
  pickSchemaData,
  generateExamples,
  enrichDataFromDocument,
  applyAutoTimestamps,
  matchDynamicPath,
  getCollectionPath,
  getEndpointMatchPaths,
  getVersionedApiPath,
  normalizeNetworkAccessInput,
  validateNetworkAccessInput,
  resolveEffectiveNetworkAccess,
  checkNetworkAccess,
} from '../utils';
import { computeExpiresAt, normalizeDataRetentionDays } from '../utils/data-retention';
import { resolveLogSource, shouldSkipApiAuditLog } from '../utils/logSource';
import { resolveLogUserId, compactLogEntry } from '../utils/auditLog';
import { LogSource } from '../types';
import { CreateEndpointDto, UpdateEndpointDto, CreateEndpointGroupDto, UpdateEndpointGroupDto, TestEndpointDto } from '../dto';
import { IEndpoint } from '../models';
import { JwtPayload, HttpMethod, TestEndpointResult, Permission, SchemaField, NetworkAccessRules } from '../types';
import { authService } from './auth.service';
import { userService, groupService } from './user.service';
import { handlerRuntime } from './handler-runtime.service';
import { webhookService } from './webhook.service';
import { dispatchTelegram, notifyCrmMutation } from './wash-notify.service';

function assertAnyPermission(user: JwtPayload | undefined, ...permissions: Permission[]): asserts user is JwtPayload {
  if (!user) throw new Error('Unauthorized');
  if (!permissions.some((permission) => user.permissions.includes(permission))) {
    throw new Error('Forbidden: insufficient permissions');
  }
}

function parseNetworkAccessInput(input?: Partial<NetworkAccessRules> | null): NetworkAccessRules {
  const normalized = normalizeNetworkAccessInput(input);
  const errors = validateNetworkAccessInput(normalized);
  if (errors.length) throw new Error(errors.join('; '));
  return normalized;
}

async function executeSystemEndpoint(
  endpoint: IEndpoint,
  req: {
    method: string;
    path: string;
    body?: unknown;
    params?: Record<string, string>;
    query?: Record<string, string>;
    user?: JwtPayload;
    headers?: Record<string, string>;
  }
): Promise<unknown> {
  const path = normalizePath(req.path);
  const method = req.method.toUpperCase();
  const body = (req.body || {}) as Record<string, unknown>;

  if (endpoint.accessType === 'public') {
    switch (`${method} ${path}`) {
      case 'POST /api/auth/login':
        return {
          success: true,
          data: await authService.login(
            { login: String(body.login || ''), password: String(body.password || '') },
            { headers: req.headers || {} }
          ),
        };
      case 'POST /api/auth/refresh':
        return {
          success: true,
          data: await authService.refresh(String(body.refreshToken || '')),
        };
      case 'POST /api/auth/register':
        return {
          success: true,
          data: await authService.register(
            {
              login: String(body.login || ''),
              email: String(body.email || ''),
              password: String(body.password || ''),
              name: String(body.name || ''),
            },
            { headers: req.headers || {} }
          ),
        };
      default:
        break;
    }
  }

  if (endpoint.accessType === 'authenticated' && !req.user) {
    throw new Error('Unauthorized');
  }

  switch (`${method} ${path}`) {
    case 'GET /api/users': {
      assertAnyPermission(req.user, 'manage_users', 'view');
      const page = parseInt(String(req.query?.page || '1'), 10);
      const limit = parseInt(String(req.query?.limit || '20'), 10);
      const search = typeof req.query?.search === 'string' ? req.query.search : undefined;
      return { success: true, data: await userService.getAll(page, limit, search) };
    }
    case 'GET /api/groups': {
      assertAnyPermission(req.user, 'manage_users', 'view');
      return { success: true, data: await groupService.getAll() };
    }
    case 'GET /api/profile': {
      if (!req.user) throw new Error('Unauthorized');
      return { success: true, data: await userService.getProfile(req.user.userId) };
    }
    case 'POST /api/auth/logout': {
      if (!req.user) throw new Error('Unauthorized');
      await authService.logout(req.user.userId, { headers: req.headers || {} });
      return { success: true, message: 'Logged out successfully' };
    }
    default:
      throw new Error('System endpoint test is not supported for this path');
  }
}

export class EndpointService {
  async getAll(page = 1, limit = 50) {
    return endpointRepository.findPaginated(page, limit);
  }

  async getById(id: string) {
    const endpoint = await endpointRepository.findById(id);
    if (!endpoint) throw new Error('Endpoint not found');
    return endpoint;
  }

  async create(dto: CreateEndpointDto, userId?: string) {
    const path = normalizePath(dto.path);
    const method = dto.method.toUpperCase() as HttpMethod;

    const existing = await endpointRepository.findByPathAndMethod(path, method);
    if (existing) throw new Error('Endpoint with this path and method already exists');

    const endpoint = await endpointRepository.create({
      name: dto.name,
      description: dto.description,
      slug: dto.slug,
      path,
      method,
      apiVersion: dto.apiVersion?.trim() || undefined,
      groupId: dto.groupId as unknown as import('mongoose').Types.ObjectId,
      fields: (dto.schema || []).map((f, i) => ({
        name: f.name,
        type: f.type as import('../types').FieldType,
        required: f.required ?? false,
        description: f.description,
        defaultValue: f.defaultValue,
        order: f.order ?? i,
        children: f.children as import('../types').SchemaField[] | undefined,
        refEndpointId: f.refEndpointId,
      })),
      accessType: (dto.accessType as import('../types').AccessType) || 'authenticated',
      allowedGroupIds: (dto.allowedGroupIds || []) as unknown as import('mongoose').Types.ObjectId[],
      networkAccess: dto.networkAccess ? parseNetworkAccessInput(dto.networkAccess) : undefined,
      inheritGroupNetworkAccess: dto.inheritGroupNetworkAccess ?? true,
      handlers: (dto.handlers || []).map((h) => ({
        name: h.name,
        type: h.type as 'pre' | 'post' | 'transform' | 'javascript',
        code: h.code,
        enabled: h.enabled ?? true,
      })),
      dataRetentionDays: normalizeDataRetentionDays(dto.dataRetentionDays),
      isSystem: false,
      enabled: true,
      createdBy: userId as unknown as import('mongoose').Types.ObjectId,
    });

    await logRepository.create({
      action: 'endpoint_create',
      userId: userId as unknown as import('mongoose').Types.ObjectId,
      endpointId: endpoint._id,
      message: `Endpoint ${endpoint.name} (${method} ${path}) created`,
    });

    void webhookService.dispatch('endpoint.created', {
      endpointId: endpoint._id.toString(),
      name: endpoint.name,
      path: endpoint.path,
      method: endpoint.method,
      apiVersion: endpoint.apiVersion,
    });

    return endpoint;
  }

  async update(id: string, dto: UpdateEndpointDto, userId?: string) {
    const endpoint = await endpointRepository.findById(id);
    if (!endpoint) throw new Error('Endpoint not found');

    const updateData: Record<string, unknown> = {};

    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.slug !== undefined) updateData.slug = dto.slug;

    const nextPath = dto.path !== undefined ? normalizePath(dto.path) : endpoint.path;
    const nextMethod = (dto.method !== undefined ? dto.method : endpoint.method).toUpperCase() as HttpMethod;

    if (dto.path !== undefined || dto.method !== undefined) {
      if (endpoint.isSystem && (nextPath !== endpoint.path || nextMethod !== endpoint.method)) {
        throw new Error('Cannot change path or method of system endpoint');
      }

      const duplicate = await endpointRepository.findByPathAndMethod(nextPath, nextMethod, id);
      if (duplicate) throw new Error('Endpoint with this path and method already exists');

      if (dto.path !== undefined && nextPath !== endpoint.path) {
        const oldCollection = getCollectionPath(endpoint.path);
        const newCollection = getCollectionPath(nextPath);
        if (oldCollection !== newCollection) {
          await endpointDataRepository.migrateResourcePathForEndpoint(id, newCollection);
        }
        updateData.path = nextPath;
      }

      if (dto.method !== undefined) updateData.method = nextMethod;
    }
    const unsetFields: string[] = [];
    if (dto.apiVersion !== undefined) {
      const version = dto.apiVersion === null ? '' : String(dto.apiVersion).trim();
      if (version) {
        updateData.apiVersion = version;
      } else {
        unsetFields.push('apiVersion');
      }
    }
    if (dto.groupId !== undefined) updateData.groupId = dto.groupId;
    if (dto.accessType !== undefined) updateData.accessType = dto.accessType;
    if (dto.allowedGroupIds !== undefined) updateData.allowedGroupIds = dto.allowedGroupIds;
    if (dto.enabled !== undefined) updateData.enabled = dto.enabled;
    if (dto.networkAccess !== undefined) updateData.networkAccess = parseNetworkAccessInput(dto.networkAccess);
    if (dto.inheritGroupNetworkAccess !== undefined) updateData.inheritGroupNetworkAccess = dto.inheritGroupNetworkAccess;
    if (dto.dataRetentionDays !== undefined) {
      updateData.dataRetentionDays = normalizeDataRetentionDays(dto.dataRetentionDays);
    }

    if (dto.schema !== undefined) {
      updateData.fields = dto.schema.map((f, i) => ({
        name: f.name,
        type: f.type,
        required: f.required ?? false,
        description: f.description,
        defaultValue: f.defaultValue,
        order: f.order ?? i,
        children: f.children,
        refEndpointId: f.refEndpointId,
      }));
    }

    if (dto.handlers !== undefined) {
      updateData.handlers = dto.handlers.map((h) => ({
        name: h.name,
        type: h.type,
        code: h.code,
        enabled: h.enabled ?? true,
      }));
    }

    const mongoUpdate: Record<string, unknown> = { ...updateData };
    if (unsetFields.length) {
      mongoUpdate.$unset = Object.fromEntries(unsetFields.map((field) => [field, 1]));
    }

    const updated = await endpointRepository.update(id, mongoUpdate);

    await logRepository.create({
      action: 'endpoint_update',
      userId: userId as unknown as import('mongoose').Types.ObjectId,
      endpointId: endpoint._id,
      message: `Endpoint ${endpoint.name} updated`,
    });

    void webhookService.dispatch('endpoint.updated', {
      endpointId: id,
      name: updated?.name || endpoint.name,
      path: updated?.path || endpoint.path,
      method: updated?.method || endpoint.method,
    });

    return updated;
  }

  async delete(id: string, userId?: string) {
    const endpoint = await endpointRepository.findById(id);
    if (!endpoint) throw new Error('Endpoint not found');
    if (endpoint.isSystem) throw new Error('Cannot delete system endpoint');

    const deleted = await endpointRepository.delete(id);
    if (!deleted) throw new Error('Failed to delete endpoint');

    await logRepository.create({
      action: 'endpoint_delete',
      userId: userId as unknown as import('mongoose').Types.ObjectId,
      endpointId: endpoint._id,
      message: `Endpoint ${endpoint.name} deleted`,
    });

    void webhookService.dispatch('endpoint.deleted', {
      endpointId: id,
      name: endpoint.name,
      path: endpoint.path,
      method: endpoint.method,
    });
  }

  async getExamples(id: string) {
    const endpoint = await this.getById(id);
    return generateExamples(endpoint.fields);
  }

  async getDocumentation(id: string) {
    const endpoint = await this.getById(id);
    const examples = generateExamples(endpoint.fields);
    return {
      name: endpoint.name,
      description: endpoint.description,
      url: getVersionedApiPath(endpoint.path, endpoint.apiVersion),
      method: endpoint.method,
      accessType: endpoint.accessType,
      parameters: endpoint.fields,
      dataRetentionDays: endpoint.dataRetentionDays ?? null,
      requestBody: examples.request,
      exampleResponse: examples.response,
    };
  }

  async testEndpoint(id: string, dto: TestEndpointDto, user?: JwtPayload): Promise<TestEndpointResult> {
    const endpoint = await this.getById(id);
    const startTime = Date.now();

    const method = (dto.method || endpoint.method) as HttpMethod;
    const path = dto.path || getVersionedApiPath(endpoint.path, endpoint.apiVersion);

    const mockReq = {
      method,
      path,
      body: dto.body,
      params: dto.params || {},
      query: dto.query || {},
      user,
      headers: dto.headers || {},
    };

    try {
      const raw = endpoint.isSystem
        ? await executeSystemEndpoint(endpoint, mockReq)
        : await dynamicEngine.execute(endpoint, mockReq, {
            skipNetworkCheck: dto.applyNetworkAccess !== true,
            networkMeta: {
              ip: dto.clientIp,
              headers: dto.headers,
            },
          });
      const isHandlerResponse =
        raw && typeof raw === 'object' && '__handlerResponse' in (raw as object);
      const statusCode = isHandlerResponse
        ? Number((raw as { statusCode: number }).statusCode) || 200
        : 200;
      const body = isHandlerResponse ? (raw as { body: unknown }).body : raw;
      const responseTime = Date.now() - startTime;

      return {
        request: {
          method,
          url: path,
          headers: dto.headers || {},
          body: dto.body,
          params: dto.params,
        },
        response: {
          statusCode,
          headers: { 'content-type': 'application/json' },
          body,
          responseTime,
        },
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const message = error instanceof Error ? error.message : 'Unknown error';
      const statusCode = message.includes('not found') ? 404 : message.includes('Forbidden') ? 403 : message.includes('Unauthorized') ? 401 : 400;

      return {
        request: {
          method,
          url: path,
          headers: dto.headers || {},
          body: dto.body,
          params: dto.params,
        },
        response: {
          statusCode,
          headers: { 'content-type': 'application/json' },
          body: { success: false, error: message },
          responseTime,
        },
      };
    }
  }
}

export class EndpointGroupService {
  async getAll() {
    return endpointGroupRepository.findAll();
  }

  async create(dto: CreateEndpointGroupDto) {
    const { networkAccess, ...rest } = dto;
    const payload: Partial<import('../models').IEndpointGroup> = { ...rest };
    if (networkAccess !== undefined) {
      payload.networkAccess = parseNetworkAccessInput(networkAccess);
    }
    return endpointGroupRepository.create(payload);
  }

  async update(id: string, dto: UpdateEndpointGroupDto) {
    const group = await endpointGroupRepository.findById(id);
    if (!group) throw new Error('Endpoint group not found');
    const { networkAccess, ...rest } = dto;
    const payload: Partial<import('../models').IEndpointGroup> = { ...rest };
    if (networkAccess !== undefined) {
      payload.networkAccess = parseNetworkAccessInput(networkAccess);
    }
    return endpointGroupRepository.update(id, payload);
  }

  async delete(id: string) {
    const deleted = await endpointGroupRepository.delete(id);
    if (!deleted) throw new Error('Endpoint group not found');
  }
}

export class DynamicEngine {
  async findMatchingEndpoint(requestPath: string, method: string): Promise<{ endpoint: IEndpoint; params: Record<string, string> } | null> {
    const endpoints = await endpointRepository.findDynamicEndpoints();

    for (const endpoint of endpoints) {
      const paths = getEndpointMatchPaths(endpoint.path, endpoint.apiVersion);
      for (const epPath of paths) {
        const { match, params } = matchDynamicPath(epPath, requestPath);
        if (match && endpoint.method === method.toUpperCase()) {
          return { endpoint, params };
        }
      }
    }

    return null;
  }

  checkAccess(endpoint: IEndpoint, user?: JwtPayload): void {
    if (endpoint.accessType === 'public') return;

    if (endpoint.accessType === 'authenticated') {
      if (!user) throw new Error('Unauthorized');
      return;
    }

    if (endpoint.accessType === 'group') {
      if (!user) throw new Error('Unauthorized');
      const hasAccess = endpoint.allowedGroupIds.some((gid) =>
        user.groupIds.includes(gid.toString())
      );
      if (!hasAccess) throw new Error('Forbidden: insufficient group permissions');
    }
  }

  canAccessEndpoint(endpoint: IEndpoint, user?: JwtPayload): boolean {
    try {
      this.checkAccess(endpoint, user);
      return true;
    } catch {
      return false;
    }
  }

  private async assertNetworkAccess(
    endpoint: IEndpoint,
    meta?: { ip?: string; headers?: Record<string, string | string[] | undefined> },
    skip = false
  ): Promise<void> {
    if (skip) return;

    let group = null;
    if (endpoint.groupId) {
      const groupId =
        typeof endpoint.groupId === 'object' && endpoint.groupId !== null && '_id' in endpoint.groupId
          ? String((endpoint.groupId as { _id: unknown })._id)
          : String(endpoint.groupId);
      group = await endpointGroupRepository.findById(groupId);
    }

    const rules = resolveEffectiveNetworkAccess(endpoint, group);
    if (!rules) return;

    const result = checkNetworkAccess(rules, { ip: meta?.ip, headers: meta?.headers });
    if (!result.allowed) {
      throw new Error(result.reason || 'Forbidden: network access denied');
    }
  }

  private async assertReferences(data: Record<string, unknown>, fields: SchemaField[]): Promise<void> {
    const refs = await validateReferences(
      data,
      fields,
      (id) => endpointRepository.findById(id),
      (id) => endpointDataRepository.findById(id)
    );
    if (!refs.valid) throw new Error(refs.errors.join(', '));
  }

  private schemaFieldsCache = new Map<string, SchemaField[]>();

  private async resolveSchemaFields(endpoint: IEndpoint): Promise<SchemaField[]> {
    if (endpoint.fields.length > 0) return endpoint.fields;

    const collectionPath = getCollectionPath(endpoint.path);
    const cached = this.schemaFieldsCache.get(collectionPath);
    if (cached) return cached;

    const endpoints = await endpointRepository.findDynamicEndpoints();
    const merged = new Map<string, SchemaField>();
    for (const ep of endpoints) {
      if (getCollectionPath(ep.path) !== collectionPath) continue;
      for (const field of ep.fields) {
        if (!merged.has(field.name)) merged.set(field.name, field);
      }
    }
    const fields = [...merged.values()].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    this.schemaFieldsCache.set(collectionPath, fields);
    return fields;
  }

  private formatRecord(
    record: { _id: unknown; data: Record<string, unknown>; createdAt?: Date },
    fields: SchemaField[]
  ): Record<string, unknown> {
    return enrichDataFromDocument(
      { id: record._id, ...record.data },
      fields,
      { createdAt: record.createdAt }
    );
  }

  private async populateReferences(
    data: Record<string, unknown>,
    fields: SchemaField[],
    populateQuery?: string
  ): Promise<Record<string, unknown>> {
    if (!populateQuery) return data;

    const populateAll = populateQuery === 'true' || populateQuery === '1';
    const selected = populateAll
      ? fields.filter((field) => field.type === 'reference').map((field) => field.name)
      : populateQuery.split(',').map((name) => name.trim()).filter(Boolean);

    const result = { ...data };
    for (const field of fields) {
      if (field.type !== 'reference' || !selected.includes(field.name)) continue;
      const value = result[field.name];
      if (typeof value !== 'string') continue;

      const refRecord = await endpointDataRepository.findById(value);
      if (refRecord) {
        result[field.name] = { id: refRecord._id, ...refRecord.data };
      }
    }

    return result;
  }

  async execute(
    endpoint: IEndpoint,
    req: {
      method: string;
      path: string;
      body?: unknown;
      params?: Record<string, string>;
      query?: Record<string, string>;
      user?: JwtPayload;
    },
    options?: {
      skipNetworkCheck?: boolean;
      networkMeta?: { ip?: string; headers?: Record<string, string | string[] | undefined> };
    }
  ): Promise<unknown> {
    await this.assertNetworkAccess(endpoint, options?.networkMeta, options?.skipNetworkCheck);
    this.checkAccess(endpoint, req.user);

    const params = req.params || {};
    const collectionPath = getCollectionPath(endpoint.path);

    const jsHandler = endpoint.handlers?.find(
      (h) => h.type === 'javascript' && h.enabled && h.code?.trim()
    );
    if (jsHandler?.code) {
      const result = await handlerRuntime.run(
        jsHandler.code,
        {
          method: req.method,
          path: req.path,
          params,
          query: req.query || {},
          body: req.body,
          user: req.user,
          headers: options?.networkMeta?.headers || {},
        },
        endpoint._id.toString(),
        collectionPath,
        endpoint.dataRetentionDays
      );
      return { __handlerResponse: true, statusCode: result.statusCode, body: result.body };
    }

    const hasIdParam = Object.keys(params).length > 0;
    const idParam = params.id || Object.values(params)[0];
    const populate = req.query?.populate;
    const schemaFields = await this.resolveSchemaFields(endpoint);

    switch (endpoint.method) {
      case 'GET':
        if (hasIdParam && idParam) {
          const record = await endpointDataRepository.findById(idParam);
          if (!record || record.resourcePath !== collectionPath) {
            throw new Error('Record not found');
          }
          const data = await this.populateReferences(
            this.formatRecord(record, schemaFields),
            schemaFields,
            populate
          );
          return { success: true, data };
        }
        {
          const page = parseInt(String(req.query?.page || '1'), 10);
          const limit = parseInt(String(req.query?.limit || '20'), 10);
          const result = await endpointDataRepository.findByPath(collectionPath, page, limit);
          const data = await Promise.all(
            result.data.map((item) =>
              this.populateReferences(this.formatRecord(item, schemaFields), schemaFields, populate)
            )
          );
          return {
            success: true,
            data,
            pagination: { total: result.total, page: result.page, limit: result.limit, totalPages: result.totalPages },
          };
        }

      case 'POST': {
        const rawBody = (req.body || {}) as Record<string, unknown>;
        const validation = validateDataAgainstSchema(rawBody, endpoint.fields);
        if (!validation.valid) throw new Error(validation.errors.join(', '));

        const data = applyAutoTimestamps(
          applyDefaults(pickSchemaData(rawBody, endpoint.fields), endpoint.fields),
          endpoint.fields
        );
        await this.assertReferences(data, endpoint.fields);

        const delivery = Array.isArray(data.channels) ? (data.channels as string[]) : [];
        const webEnabled = delivery.length === 0 || delivery.includes('web');
        if (collectionPath === '/api/crm/notifications' && !webEnabled) {
          return { success: true, data: { id: 'telegram-only', ...data } };
        }

        const record = await endpointDataRepository.create(
          endpoint._id.toString(),
          collectionPath,
          data,
          { expiresAt: computeExpiresAt(endpoint.dataRetentionDays) }
        );
        return { success: true, data: this.formatRecord(record, endpoint.fields) };
      }

      case 'PUT':
      case 'PATCH': {
        if (!idParam) throw new Error('ID parameter required for update');
        const existing = await endpointDataRepository.findById(idParam);
        if (!existing || existing.resourcePath !== collectionPath) {
          throw new Error('Record not found');
        }

        const rawBody = (req.body || {}) as Record<string, unknown>;
        if (endpoint.method === 'PATCH') {
          const patchValidation = validateDataAgainstSchema(rawBody, endpoint.fields, { partial: true });
          if (!patchValidation.valid) throw new Error(patchValidation.errors.join(', '));
        }

        const body = pickSchemaData(rawBody, endpoint.fields);
        const merged = endpoint.method === 'PATCH'
          ? { ...existing.data, ...body }
          : body;

        const validation = validateDataAgainstSchema(merged as Record<string, unknown>, endpoint.fields);
        if (!validation.valid) throw new Error(validation.errors.join(', '));

        const sanitized = pickSchemaData(merged as Record<string, unknown>, endpoint.fields);
        await this.assertReferences(sanitized, endpoint.fields);
        const updated = await endpointDataRepository.update(idParam, sanitized);
        const responseFields = await this.resolveSchemaFields(endpoint);
        return { success: true, data: this.formatRecord(updated!, responseFields) };
      }

      case 'DELETE': {
        if (!idParam) throw new Error('ID parameter required for delete');
        const existing = await endpointDataRepository.findById(idParam);
        if (!existing || existing.resourcePath !== collectionPath) {
          throw new Error('Record not found');
        }
        await endpointDataRepository.delete(idParam);
        return { success: true, message: 'Record deleted' };
      }

      default:
        throw new Error(`Unsupported method: ${endpoint.method}`);
    }
  }

  async handleRequest(
    requestPath: string,
    method: string,
    body: unknown,
    query: Record<string, string>,
    user?: JwtPayload,
    meta?: {
      ip?: string;
      userAgent?: string;
      headers?: Record<string, string | string[] | undefined>;
      source?: LogSource;
      skipAuditLog?: boolean;
    }
  ): Promise<{ statusCode: number; body: unknown }> {
    const startTime = Date.now();
    const match = await this.findMatchingEndpoint(requestPath, method);

    if (!match) {
      return { statusCode: 404, body: { success: false, error: 'Endpoint not found' } };
    }

    const { endpoint, params } = match;

    try {
      const result = await this.execute(endpoint, {
        method,
        path: requestPath,
        body,
        params,
        query,
        user,
      }, {
        networkMeta: { ip: meta?.ip, headers: meta?.headers },
      });

      const isHandlerResponse =
        result && typeof result === 'object' && '__handlerResponse' in (result as object);
      const statusCode = isHandlerResponse
        ? Number((result as { statusCode: number }).statusCode) || 200
        : 200;
      const responseBody = isHandlerResponse
        ? (result as { body: unknown }).body
        : result;

      await endpointRepository.incrementCallCount(endpoint._id.toString());

      const responseTime = Date.now() - startTime;
      const source = resolveLogSource(meta, user);

      if (!shouldSkipApiAuditLog(meta)) {
        await logRepository.create(compactLogEntry({
          action: 'api_call',
          source,
          userId: resolveLogUserId(user),
          endpointId: endpoint._id,
          message: `${method} ${requestPath} - ${statusCode}`,
          statusCode,
          responseTime,
          ip: meta?.ip,
          userAgent: meta?.userAgent,
        }));
      }

      void webhookService.dispatch('endpoint.called', {
        endpointId: endpoint._id.toString(),
        path: requestPath,
        method,
        statusCode,
        userId: user?.userId,
      });

      if (statusCode < 300) {
        if (requestPath.startsWith('/api/crm/notifications') && method === 'POST') {
          const payload = (body ?? {}) as Record<string, unknown>;
          const delivery = payload.channels as string[] | undefined;
          if (delivery?.includes('telegram') && typeof payload.message === 'string') {
            const severity = String(payload.severity ?? 'info');
            const prefix = severity === 'error' ? '🔴' : severity === 'warning' ? '🟡' : 'ℹ️';
            void dispatchTelegram(`${prefix} ${payload.message}`);
          }
        } else {
          void notifyCrmMutation(method, requestPath, user, body);
        }
      }

      return { statusCode, body: responseBody };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error';
      const statusCode = message.includes('not found') ? 404
        : message.includes('Forbidden') ? 403
        : message.includes('Unauthorized') ? 401
        : 400;

      void webhookService.dispatch('api.error', {
        path: requestPath,
        method,
        statusCode,
        error: message,
        endpointId: endpoint._id.toString(),
      });

      const responseTime = Date.now() - startTime;
      const source = resolveLogSource(meta, user);

      if (!shouldSkipApiAuditLog(meta)) {
        await logRepository.create(compactLogEntry({
          action: 'error',
          source,
          userId: resolveLogUserId(user),
          endpointId: endpoint._id,
          message: `${method} ${requestPath} - ${statusCode}: ${message}`,
          statusCode,
          responseTime,
          ip: meta?.ip,
          userAgent: meta?.userAgent,
          details: { error: message },
        }));
      }

      return { statusCode, body: { success: false, error: message } };
    }
  }
}

export const endpointService = new EndpointService();
export const endpointGroupService = new EndpointGroupService();
export const dynamicEngine = new DynamicEngine();
