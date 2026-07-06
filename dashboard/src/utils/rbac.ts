import type { DapGroup, DapUser, Permission } from '../types';

export const PERMISSION_LABELS: Record<Permission, string> = {
  view: 'Просмотр',
  create: 'Создание',
  update: 'Изменение',
  delete: 'Удаление',
  manage_users: 'Управление пользователями',
  manage_api: 'Управление API',
  view_logs: 'Просмотр логов',
};

export const ALL_PERMISSIONS: Permission[] = [
  'view',
  'create',
  'update',
  'delete',
  'manage_users',
  'manage_api',
  'view_logs',
];

export const USER_STATUS_LABELS: Record<string, string> = {
  active: 'Активен',
  inactive: 'Неактивен',
  suspended: 'Заблокирован',
};

export function entityId(row: { id?: string; _id?: unknown }): string {
  if (row.id) return String(row.id);
  if (row._id != null) return String(row._id);
  return '';
}

/** Mongo populate возвращает объекты — приводим к строковому id */
export function normalizeGroupId(ref: unknown): string {
  if (typeof ref === 'string') return ref;
  if (ref && typeof ref === 'object') {
    const obj = ref as { _id?: unknown; id?: unknown };
    if (obj._id != null) return String(obj._id);
    if (obj.id != null) return String(obj.id);
  }
  return '';
}

export function resolveGroupLabel(ref: unknown, groups: { id: string; name: string }[]): string {
  if (ref && typeof ref === 'object') {
    const obj = ref as { name?: unknown };
    if (typeof obj.name === 'string' && obj.name) return obj.name;
  }
  const id = normalizeGroupId(ref);
  if (!id) return '—';
  return groups.find((g) => g.id === id)?.name ?? id.slice(-6);
}

export function normalizeDapUser(raw: Record<string, unknown>): DapUser {
  const id = entityId(raw as { id?: string; _id?: unknown });
  const groupIds = Array.isArray(raw.groupIds)
    ? raw.groupIds.map(normalizeGroupId).filter(Boolean)
    : [];
  return {
    id,
    _id: id,
    login: String(raw.login ?? ''),
    email: String(raw.email ?? ''),
    name: String(raw.name ?? ''),
    status: (raw.status as DapUser['status']) || 'active',
    groupIds,
    createdAt: raw.createdAt as string | undefined,
    lastLoginAt: raw.lastLoginAt as string | undefined,
  };
}

export function normalizeDapGroup(raw: Record<string, unknown>): DapGroup {
  const id = entityId(raw as { id?: string; _id?: unknown });
  return {
    id,
    _id: id,
    name: String(raw.name ?? ''),
    description: raw.description ? String(raw.description) : undefined,
    permissions: Array.isArray(raw.permissions) ? (raw.permissions as Permission[]) : [],
    isSystem: Boolean(raw.isSystem),
  };
}
