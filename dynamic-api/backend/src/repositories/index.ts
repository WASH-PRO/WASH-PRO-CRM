import { User, IUser, Group, IGroup, Endpoint, IEndpoint, EndpointGroup, IEndpointGroup, EndpointData, IEndpointData, Log, ILog } from '../models';
import { PaginatedResult } from '../types';
import { buildTextSearchFilter } from '../utils';
import { compactLogEntry } from '../utils/auditLog';
import { FilterQuery } from 'mongoose';

export class UserRepository {
  async findById(id: string): Promise<IUser | null> {
    return User.findById(id).populate('groupIds');
  }

  async findByLogin(login: string): Promise<IUser | null> {
    return User.findOne({ login: login.toLowerCase() }).populate('groupIds');
  }

  async findByEmail(email: string): Promise<IUser | null> {
    return User.findOne({ email: email.toLowerCase() });
  }

  async findAll(page = 1, limit = 20, search?: string): Promise<PaginatedResult<IUser>> {
    const skip = (page - 1) * limit;
    const filter = buildTextSearchFilter(search, ['name', 'login', 'email', 'status']) || {};
    const [data, total] = await Promise.all([
      User.find(filter).populate('groupIds').skip(skip).limit(limit).sort({ createdAt: -1 }),
      User.countDocuments(filter),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async create(data: Partial<IUser>): Promise<IUser> {
    return User.create(data);
  }

  async update(id: string, data: Partial<IUser>): Promise<IUser | null> {
    return User.findByIdAndUpdate(id, data, { new: true }).populate('groupIds');
  }

  async delete(id: string): Promise<boolean> {
    const result = await User.findByIdAndDelete(id);
    return !!result;
  }

  async count(): Promise<number> {
    return User.countDocuments();
  }

  async countActive(since: Date): Promise<number> {
    return User.countDocuments({ lastLoginAt: { $gte: since } });
  }
}

export class GroupRepository {
  async findById(id: string): Promise<IGroup | null> {
    return Group.findById(id);
  }

  async findByName(name: string): Promise<IGroup | null> {
    return Group.findOne({ name });
  }

  async findAll(): Promise<IGroup[]> {
    return Group.find().sort({ name: 1 });
  }

  async create(data: Partial<IGroup>): Promise<IGroup> {
    return Group.create(data);
  }

  async update(id: string, data: Partial<IGroup>): Promise<IGroup | null> {
    return Group.findByIdAndUpdate(id, data, { new: true });
  }

  async delete(id: string): Promise<boolean> {
    const group = await Group.findById(id);
    if (!group || group.isSystem) return false;
    const result = await Group.findByIdAndDelete(id);
    return !!result;
  }

  async count(): Promise<number> {
    return Group.countDocuments();
  }
}

export class EndpointRepository {
  async findById(id: string): Promise<IEndpoint | null> {
    return Endpoint.findById(id).populate('groupId').populate('allowedGroupIds');
  }

  async findByPathAndMethod(path: string, method: string, excludeId?: string): Promise<IEndpoint | null> {
    const filter: FilterQuery<IEndpoint> = { path, method: method.toUpperCase() };
    if (excludeId) filter._id = { $ne: excludeId };
    return Endpoint.findOne(filter);
  }

  async findAll(filter: FilterQuery<IEndpoint> = {}): Promise<IEndpoint[]> {
    return Endpoint.find(filter).populate('groupId').sort({ createdAt: -1 });
  }

  async findPaginated(page = 1, limit = 20, filter: FilterQuery<IEndpoint> = {}): Promise<PaginatedResult<IEndpoint>> {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      Endpoint.find(filter).populate('groupId').skip(skip).limit(limit).sort({ createdAt: -1 }),
      Endpoint.countDocuments(filter),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findDynamicEndpoints(): Promise<IEndpoint[]> {
    return Endpoint.find({ isSystem: false, enabled: true });
  }

  async create(data: Partial<IEndpoint>): Promise<IEndpoint> {
    return Endpoint.create(data);
  }

  async update(id: string, data: Partial<IEndpoint>): Promise<IEndpoint | null> {
    return Endpoint.findByIdAndUpdate(id, data, { new: true }).populate('groupId');
  }

  async delete(id: string): Promise<boolean> {
    const endpoint = await Endpoint.findById(id);
    if (!endpoint || endpoint.isSystem) return false;
    await EndpointData.deleteMany({ endpointId: id });
    const result = await Endpoint.findByIdAndDelete(id);
    return !!result;
  }

  async incrementCallCount(id: string): Promise<void> {
    await Endpoint.findByIdAndUpdate(id, { $inc: { callCount: 1 } });
  }

  async count(filter: FilterQuery<IEndpoint> = {}): Promise<number> {
    return Endpoint.countDocuments(filter);
  }
}

export class EndpointGroupRepository {
  async findAll(): Promise<IEndpointGroup[]> {
    return EndpointGroup.find().sort({ order: 1, name: 1 });
  }

  async findById(id: string): Promise<IEndpointGroup | null> {
    return EndpointGroup.findById(id);
  }

  async create(data: Partial<IEndpointGroup>): Promise<IEndpointGroup> {
    return EndpointGroup.create(data);
  }

  async update(id: string, data: Partial<IEndpointGroup>): Promise<IEndpointGroup | null> {
    return EndpointGroup.findByIdAndUpdate(id, data, { new: true });
  }

  async delete(id: string): Promise<boolean> {
    const result = await EndpointGroup.findByIdAndDelete(id);
    return !!result;
  }

  async count(): Promise<number> {
    return EndpointGroup.countDocuments();
  }
}

export class EndpointDataRepository {
  async findByEndpoint(endpointId: string, page = 1, limit = 20): Promise<PaginatedResult<IEndpointData>> {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      EndpointData.find({ endpointId }).skip(skip).limit(limit).sort({ createdAt: -1 }),
      EndpointData.countDocuments({ endpointId }),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findByPath(resourcePath: string, page = 1, limit = 20): Promise<PaginatedResult<IEndpointData>> {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      EndpointData.find({ resourcePath }).skip(skip).limit(limit).sort({ createdAt: -1 }),
      EndpointData.countDocuments({ resourcePath }),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findById(id: string): Promise<IEndpointData | null> {
    return EndpointData.findById(id);
  }

  async create(
    endpointId: string,
    resourcePath: string,
    data: Record<string, unknown>,
    options?: { expiresAt?: Date }
  ): Promise<IEndpointData> {
    return EndpointData.create({
      endpointId,
      resourcePath,
      data,
      ...(options?.expiresAt ? { expiresAt: options.expiresAt } : {}),
    });
  }

  async update(id: string, data: Record<string, unknown>): Promise<IEndpointData | null> {
    return EndpointData.findByIdAndUpdate(id, { data }, { new: true });
  }

  async delete(id: string): Promise<boolean> {
    const result = await EndpointData.findByIdAndDelete(id);
    return !!result;
  }

  async deleteManyByPathAndDataFilter(
    resourcePath: string,
    dataFilter: Record<string, unknown>
  ): Promise<number> {
    const buildQuery = (filter: Record<string, unknown>): Record<string, unknown> => {
      if ('$or' in filter && Array.isArray(filter.$or)) {
        return { $or: filter.$or.map((item) => buildQuery(item as Record<string, unknown>)) };
      }
      const query: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(filter)) {
        if (key.startsWith('$')) {
          query[key] = value;
          continue;
        }
        query[`data.${key}`] = value;
      }
      return query;
    };

    const result = await EndpointData.deleteMany({
      resourcePath,
      ...buildQuery(dataFilter),
    });
    return result.deletedCount ?? 0;
  }

  async migrateResourcePathForEndpoint(endpointId: string, resourcePath: string): Promise<number> {
    const result = await EndpointData.updateMany({ endpointId }, { $set: { resourcePath } });
    return result.modifiedCount ?? 0;
  }
}

export class LogRepository {
  async create(data: Partial<ILog>): Promise<ILog> {
    return Log.create(compactLogEntry(data));
  }

  async findAll(page = 1, limit = 50, filter: FilterQuery<ILog> = {}): Promise<PaginatedResult<ILog>> {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      Log.find(filter).populate('userId', 'login name email').populate('endpointId', 'name path method')
        .skip(skip).limit(limit).sort({ createdAt: -1 }),
      Log.countDocuments(filter),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async count(filter: FilterQuery<ILog> = {}): Promise<number> {
    return Log.countDocuments(filter);
  }

  async countByActionOverTime(action: string, days = 7): Promise<{ date: string; count: number }[]> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const results = await Log.aggregate([
      { $match: { action, createdAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return results.map((r) => ({ date: r._id, count: r.count }));
  }

  async countLoginsOverTime(days = 7): Promise<{ date: string; count: number }[]> {
    return this.countByActionOverTime('login', days);
  }

  async countSince(filter: FilterQuery<ILog>, days = 7): Promise<number> {
    const since = new Date();
    since.setDate(since.getDate() - days);
    return Log.countDocuments({ ...filter, createdAt: { $gte: since } });
  }

  async countByActionStatusOverTime(
    action: string,
    days = 7
  ): Promise<{ date: string; success: number; error: number }[]> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const results = await Log.aggregate([
      { $match: { action, createdAt: { $gte: since } } },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            status: '$details.status',
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.date': 1 } },
    ]);

    const map = new Map<string, { success: number; error: number }>();
    for (const row of results) {
      const date = row._id.date as string;
      const entry = map.get(date) || { success: 0, error: 0 };
      if (row._id.status === 'success') entry.success += row.count;
      else entry.error += row.count;
      map.set(date, entry);
    }

    return Array.from(map.entries()).map(([date, counts]) => ({ date, ...counts }));
  }

  async countTrafficBySource(days = 7): Promise<Record<string, number>> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const [apiCalls, mcpCalls] = await Promise.all([
      Log.aggregate([
        { $match: { action: 'api_call', createdAt: { $gte: since } } },
        { $group: { _id: { $ifNull: ['$source', 'direct'] }, count: { $sum: 1 } } },
      ]),
      Log.countDocuments({ action: 'mcp_call', createdAt: { $gte: since } }),
    ]);

    const totals: Record<string, number> = { direct: 0, mcp: 0, cron: 0, api_key: 0 };
    for (const row of apiCalls) {
      const key = row._id as string;
      if (key in totals) totals[key] += row.count;
      else totals.direct += row.count;
    }
    totals.mcp += mcpCalls;
    return totals;
  }

  async countTrafficBySourceOverTime(
    days = 7
  ): Promise<{ date: string; direct: number; mcp: number; cron: number; api_key: number }[]> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const [apiCalls, mcpCalls] = await Promise.all([
      Log.aggregate([
        { $match: { action: 'api_call', createdAt: { $gte: since } } },
        {
          $group: {
            _id: {
              date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
              source: { $ifNull: ['$source', 'direct'] },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { '_id.date': 1 } },
      ]),
      Log.aggregate([
        { $match: { action: 'mcp_call', createdAt: { $gte: since } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    const map = new Map<string, { direct: number; mcp: number; cron: number; api_key: number }>();

    const ensure = (date: string) => {
      if (!map.has(date)) map.set(date, { direct: 0, mcp: 0, cron: 0, api_key: 0 });
      return map.get(date)!;
    };

    for (const row of apiCalls) {
      const date = row._id.date as string;
      const source = row._id.source as keyof ReturnType<typeof ensure>;
      const entry = ensure(date);
      if (source in entry) entry[source as 'direct' | 'mcp' | 'cron' | 'api_key'] += row.count;
      else entry.direct += row.count;
    }

    for (const row of mcpCalls) {
      ensure(row._id).mcp += row.count;
    }

    return Array.from(map.entries())
      .map(([date, counts]) => ({ date, ...counts }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  async deleteAll(): Promise<number> {
    const result = await Log.deleteMany({});
    return result.deletedCount;
  }

  async deleteOlderThan(days: number): Promise<number> {
    const since = new Date();
    since.setDate(since.getDate() - days);
    const result = await Log.deleteMany({ createdAt: { $lt: since } });
    return result.deletedCount;
  }
}

export const userRepository = new UserRepository();
export const groupRepository = new GroupRepository();
export const endpointRepository = new EndpointRepository();
export const endpointGroupRepository = new EndpointGroupRepository();
export const endpointDataRepository = new EndpointDataRepository();
export const logRepository = new LogRepository();

export {
  cronJobRepository,
  webhookRepository,
  apiKeyRepository,
  generateApiKeyRaw,
} from './automation.repositories';
