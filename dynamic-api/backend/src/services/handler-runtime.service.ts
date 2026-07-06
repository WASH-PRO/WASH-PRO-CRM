import vm from 'vm';
import { endpointDataRepository } from '../repositories';
import { JwtPayload } from '../types';
import { computeExpiresAt } from '../utils/data-retention';

const HANDLER_TIMEOUT_MS = parseInt(process.env.HANDLER_TIMEOUT_MS || '60000', 10);

export type HandlerRequest = {
  method: string;
  path: string;
  params: Record<string, string>;
  query: Record<string, string>;
  body: unknown;
  user?: JwtPayload;
  headers: Record<string, string | string[] | undefined>;
};

export type HandlerResult = {
  statusCode: number;
  body: unknown;
};

function createDbContext(endpointId: string, resourcePath: string, dataRetentionDays?: number) {
  const expiresAt = computeExpiresAt(dataRetentionDays);
  return {
    async findOne(filter: Record<string, unknown> = {}) {
      const page = await endpointDataRepository.findByPath(resourcePath, 1, 500);
      const match = page.data.find((row) =>
        Object.entries(filter).every(([key, value]) => {
          if (key === '_id' || key === 'id') return row._id.toString() === String(value);
          return (row.data as Record<string, unknown>)[key] === value;
        })
      );
      if (!match) return null;
      return { id: match._id.toString(), ...match.data };
    },

    async find(filter: Record<string, unknown> = {}, options?: { page?: number; limit?: number }) {
      const page = options?.page ?? 1;
      const limit = options?.limit ?? 20;
      const result = await endpointDataRepository.findByPath(resourcePath, page, limit);
      let rows = result.data.map((row) => ({ id: row._id.toString(), ...row.data }));

      if (Object.keys(filter).length) {
        rows = rows.filter((row) =>
          Object.entries(filter).every(([key, value]) => (row as Record<string, unknown>)[key] === value)
        );
      }

      return {
        data: rows,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages,
        },
      };
    },

    async create(data: Record<string, unknown>) {
      const record = await endpointDataRepository.create(endpointId, resourcePath, data, { expiresAt });
      return { id: record._id.toString(), ...record.data };
    },

    async update(id: string, data: Record<string, unknown>) {
      const existing = await endpointDataRepository.findById(id);
      if (!existing || existing.resourcePath !== resourcePath) {
        throw new Error('Record not found');
      }
      const merged = { ...existing.data, ...data };
      const updated = await endpointDataRepository.update(id, merged as Record<string, unknown>);
      return { id: updated!._id.toString(), ...updated!.data };
    },

    async delete(id: string) {
      const existing = await endpointDataRepository.findById(id);
      if (!existing || existing.resourcePath !== resourcePath) {
        throw new Error('Record not found');
      }
      await endpointDataRepository.delete(id);
      return { success: true };
    },

    at(otherResourcePath: string) {
      return createDbContext(endpointId, otherResourcePath, dataRetentionDays);
    },
  };
}

function normalizeHandlerOutput(output: unknown): HandlerResult {
  if (output && typeof output === 'object') {
    const obj = output as Record<string, unknown>;
    if ('status' in obj || 'statusCode' in obj) {
      const statusCode = Number(obj.status ?? obj.statusCode ?? 200);
      const body = obj.data ?? obj.body ?? { success: true };
      return { statusCode, body };
    }
    if ('success' in obj || 'data' in obj || 'error' in obj) {
      return { statusCode: 200, body: obj };
    }
  }
  return { statusCode: 200, body: { success: true, data: output } };
}

export class HandlerRuntimeService {
  async run(
    code: string,
    req: HandlerRequest,
    endpointId: string,
    resourcePath: string,
    dataRetentionDays?: number
  ): Promise<HandlerResult> {
    const db = createDbContext(endpointId, resourcePath, dataRetentionDays);
    const sandbox: Record<string, unknown> = {
      req,
      db,
      console: {
        log: (...args: unknown[]) => {
          if (process.env.NODE_ENV !== 'production') {
            console.log('[handler]', ...args);
          }
        },
      },
    };

    const wrapped = `(async () => {
${code}
if (typeof handler !== 'function') {
  throw new Error('Define async function handler(req, db) { ... }');
}
return await handler(req, db);
})()`;

    const context = vm.createContext(sandbox);
    const script = new vm.Script(wrapped);

    try {
      const result = await script.runInContext(context, { timeout: HANDLER_TIMEOUT_MS });
      return normalizeHandlerOutput(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Handler execution failed';
      throw new Error(`Handler error: ${message}`);
    }
  }
}

export const handlerRuntime = new HandlerRuntimeService();
