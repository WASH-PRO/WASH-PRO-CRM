import { userRepository, endpointRepository, endpointGroupRepository, logRepository } from '../repositories';
import { DashboardStats } from '../types';
import { buildTextSearchFilter } from '../utils';
import { FilterQuery } from 'mongoose';
import { ILog } from '../models';

export class DashboardService {
  async getStats(): Promise<DashboardStats> {
    const since = new Date();
    since.setDate(since.getDate() - 7);

    const [users, endpoints, groups, requests, errors, activeUsers] = await Promise.all([
      userRepository.count(),
      endpointRepository.count({ isSystem: false }),
      endpointGroupRepository.count(),
      logRepository.count({ action: 'api_call' }),
      logRepository.count({ action: 'error' }),
      userRepository.countActive(since),
    ]);

    const [requestsOverTime, errorsOverTime, userActivity] = await Promise.all([
      logRepository.countByActionOverTime('api_call', 7),
      logRepository.countByActionOverTime('error', 7),
      logRepository.countLoginsOverTime(7),
    ]);

    return {
      users,
      endpoints,
      requests,
      errors,
      groups,
      activeUsers,
      requestsOverTime: this.fillMissingDays(requestsOverTime, 7),
      errorsOverTime: this.fillMissingDays(errorsOverTime, 7),
      userActivity: this.fillMissingDays(userActivity, 7),
    };
  }

  private fillMissingDays(data: { date: string; count: number }[], days: number): { date: string; count: number }[] {
    const result: { date: string; count: number }[] = [];
    const map = new Map(data.map((d) => [d.date, d.count]));

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const key = date.toISOString().split('T')[0];
      result.push({ date: key, count: map.get(key) || 0 });
    }

    return result;
  }
}

export class LogService {
  async getAll(page = 1, limit = 50, action?: string, search?: string) {
    const filter: FilterQuery<ILog> = {};
    if (action) filter.action = action;

    const textFilter = buildTextSearchFilter(search, ['message', 'action', 'ip']);
    if (textFilter) {
      Object.assign(filter, textFilter);
    }

    return logRepository.findAll(page, limit, filter);
  }
}

export const dashboardService = new DashboardService();
export const logService = new LogService();
