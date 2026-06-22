import {
  endpointRepository,
  endpointGroupRepository,
  endpointDataRepository,
  logRepository,
} from '../repositories';
import {
  normalizePath,
  validateDataAgainstSchema,
  applyDefaults,
  generateExamples,
  matchDynamicPath,
  matchesEndpointResourcePath,
} from '../utils';
import { CreateEndpointDto, UpdateEndpointDto, CreateEndpointGroupDto, UpdateEndpointGroupDto, TestEndpointDto } from '../dto';
import { IEndpoint } from '../models';
import { JwtPayload, HttpMethod, TestEndpointResult } from '../types';

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
      groupId: dto.groupId as unknown as import('mongoose').Types.ObjectId,
      fields: (dto.schema || []).map((f, i) => ({
        name: f.name,
        type: f.type as import('../types').FieldType,
        required: f.required ?? false,
        description: f.description,
        defaultValue: f.defaultValue,
        order: f.order ?? i,
        children: f.children as import('../types').SchemaField[] | undefined,
      })),
      accessType: (dto.accessType as import('../types').AccessType) || 'authenticated',
      allowedGroupIds: (dto.allowedGroupIds || []) as unknown as import('mongoose').Types.ObjectId[],
      handlers: (dto.handlers || []).map((h) => ({
        name: h.name,
        type: h.type as 'pre' | 'post' | 'transform',
        code: h.code,
        enabled: h.enabled ?? true,
      })),
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

    return endpoint;
  }

  async update(id: string, dto: UpdateEndpointDto, userId?: string) {
    const endpoint = await endpointRepository.findById(id);
    if (!endpoint) throw new Error('Endpoint not found');

    const updateData: Record<string, unknown> = {};

    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.slug !== undefined) updateData.slug = dto.slug;
    if (dto.path !== undefined) updateData.path = normalizePath(dto.path);
    if (dto.method !== undefined) updateData.method = dto.method.toUpperCase();
    if (dto.groupId !== undefined) updateData.groupId = dto.groupId;
    if (dto.accessType !== undefined) updateData.accessType = dto.accessType;
    if (dto.allowedGroupIds !== undefined) updateData.allowedGroupIds = dto.allowedGroupIds;
    if (dto.enabled !== undefined) updateData.enabled = dto.enabled;

    if (dto.schema !== undefined) {
      updateData.fields = dto.schema.map((f, i) => ({
        name: f.name,
        type: f.type,
        required: f.required ?? false,
        description: f.description,
        defaultValue: f.defaultValue,
        order: f.order ?? i,
        children: f.children,
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

    const updated = await endpointRepository.update(id, updateData);

    await logRepository.create({
      action: 'endpoint_update',
      userId: userId as unknown as import('mongoose').Types.ObjectId,
      endpointId: endpoint._id,
      message: `Endpoint ${endpoint.name} updated`,
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
      url: endpoint.path,
      method: endpoint.method,
      accessType: endpoint.accessType,
      parameters: endpoint.fields,
      requestBody: examples.request,
      exampleResponse: examples.response,
    };
  }

  async testEndpoint(id: string, dto: TestEndpointDto, user?: JwtPayload): Promise<TestEndpointResult> {
    const endpoint = await this.getById(id);
    const startTime = Date.now();

    const method = (dto.method || endpoint.method) as HttpMethod;
    const path = dto.path || endpoint.path;

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
      const result = await dynamicEngine.execute(endpoint, mockReq);
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
          statusCode: 200,
          headers: { 'content-type': 'application/json' },
          body: result,
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
    return endpointGroupRepository.create(dto);
  }

  async update(id: string, dto: UpdateEndpointGroupDto) {
    const group = await endpointGroupRepository.findById(id);
    if (!group) throw new Error('Endpoint group not found');
    return endpointGroupRepository.update(id, dto);
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
      const { match, params } = matchDynamicPath(endpoint.path, requestPath);
      if (match && endpoint.method === method.toUpperCase()) {
        return { endpoint, params };
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

  async execute(
    endpoint: IEndpoint,
    req: {
      method: string;
      path: string;
      body?: unknown;
      params?: Record<string, string>;
      query?: Record<string, string>;
      user?: JwtPayload;
    }
  ): Promise<unknown> {
    this.checkAccess(endpoint, req.user);

    const params = req.params || {};
    const hasIdParam = Object.keys(params).length > 0;
    const idParam = params.id || Object.values(params)[0];

    switch (endpoint.method) {
      case 'GET':
        if (hasIdParam && idParam) {
          const record = await endpointDataRepository.findById(idParam);
          if (!record || !matchesEndpointResourcePath(record.resourcePath, endpoint.path)) {
            throw new Error('Record not found');
          }
          return { success: true, data: { id: record._id, ...record.data } };
        }
        {
          const page = parseInt(String(req.query?.page || '1'), 10);
          const limit = parseInt(String(req.query?.limit || '20'), 10);
          const result = await endpointDataRepository.findByPath(endpoint.path, page, limit);
          return {
            success: true,
            data: result.data.map((d) => ({ id: d._id, ...d.data })),
            pagination: { total: result.total, page: result.page, limit: result.limit, totalPages: result.totalPages },
          };
        }

      case 'POST': {
        const body = (req.body || {}) as Record<string, unknown>;
        const validation = validateDataAgainstSchema(body, endpoint.fields);
        if (!validation.valid) throw new Error(validation.errors.join(', '));

        const data = applyDefaults(body, endpoint.fields);
        const record = await endpointDataRepository.create(endpoint._id.toString(), endpoint.path, data);
        return { success: true, data: { id: record._id, ...record.data } };
      }

      case 'PUT':
      case 'PATCH': {
        if (!idParam) throw new Error('ID parameter required for update');
        const existing = await endpointDataRepository.findById(idParam);
        if (!existing || !matchesEndpointResourcePath(existing.resourcePath, endpoint.path)) {
          throw new Error('Record not found');
        }

        const body = (req.body || {}) as Record<string, unknown>;
        const merged = endpoint.method === 'PATCH'
          ? { ...existing.data, ...body }
          : body;

        const validation = validateDataAgainstSchema(merged as Record<string, unknown>, endpoint.fields);
        if (!validation.valid) throw new Error(validation.errors.join(', '));

        const updated = await endpointDataRepository.update(idParam, merged as Record<string, unknown>);
        return { success: true, data: { id: updated!._id, ...updated!.data } };
      }

      case 'DELETE': {
        if (!idParam) throw new Error('ID parameter required for delete');
        const existing = await endpointDataRepository.findById(idParam);
        if (!existing || !matchesEndpointResourcePath(existing.resourcePath, endpoint.path)) {
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
    meta?: { ip?: string; userAgent?: string }
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
      });

      await endpointRepository.incrementCallCount(endpoint._id.toString());

      const responseTime = Date.now() - startTime;
      await logRepository.create({
        action: 'api_call',
        userId: user?.userId as unknown as import('mongoose').Types.ObjectId,
        endpointId: endpoint._id,
        message: `${method} ${requestPath} - 200`,
        statusCode: 200,
        responseTime,
        ip: meta?.ip,
        userAgent: meta?.userAgent,
      });

      return { statusCode: 200, body: result };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error';
      const statusCode = message.includes('not found') ? 404
        : message.includes('Forbidden') ? 403
        : message.includes('Unauthorized') ? 401
        : 400;

      const responseTime = Date.now() - startTime;
      await logRepository.create({
        action: 'error',
        userId: user?.userId as unknown as import('mongoose').Types.ObjectId,
        endpointId: endpoint._id,
        message: `${method} ${requestPath} - ${statusCode}: ${message}`,
        statusCode,
        responseTime,
        ip: meta?.ip,
        details: { error: message },
      });

      return { statusCode, body: { success: false, error: message } };
    }
  }
}

export const endpointService = new EndpointService();
export const endpointGroupService = new EndpointGroupService();
export const dynamicEngine = new DynamicEngine();
