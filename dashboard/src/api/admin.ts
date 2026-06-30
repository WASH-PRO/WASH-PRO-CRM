import { api } from './client';
import type { DapGroup, DapUser } from '../types';
import { normalizeDapGroup, normalizeDapUser } from '../utils/rbac';

interface PaginatedUsers {
  data?: Record<string, unknown>[];
  total?: number;
  totalPages?: number;
}

export async function listDapUsers(): Promise<DapUser[]> {
  const result = await api<PaginatedUsers>('/users?page=1&limit=200');
  const raw = result?.data ?? [];
  return raw.map((u) => normalizeDapUser(u));
}

export async function listDapGroups(): Promise<DapGroup[]> {
  const result = await api<Record<string, unknown>[]>('/groups');
  return (result ?? []).map((g) => normalizeDapGroup(g));
}
