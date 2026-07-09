import type { DapGroup, DapUser, Permission } from '../types';
import { tGlobal } from '../i18n/runtime';

type TranslateFn = (key: string, params?: Record<string, string | number>) => string;

export function getPermissionLabels(t: TranslateFn): Record<Permission, string> {
  return {
    view: t('rbac.permissions.view'),
    create: t('rbac.permissions.create'),
    update: t('rbac.permissions.update'),
    delete: t('rbac.permissions.delete'),
    manage_users: t('rbac.permissions.manageUsers'),
    manage_api: t('rbac.permissions.manageApi'),
    view_logs: t('rbac.permissions.viewLogs'),
  };
}

export const PERMISSION_LABELS: Record<Permission, string> = getPermissionLabels(tGlobal);

export const ALL_PERMISSIONS: Permission[] = [
  'view',
  'create',
  'update',
  'delete',
  'manage_users',
  'manage_api',
  'view_logs',
];

export function getUserStatusLabels(t: TranslateFn): Record<string, string> {
  return {
    active: t('rbac.userStatus.active'),
    inactive: t('rbac.userStatus.inactive'),
    suspended: t('rbac.userStatus.suspended'),
  };
}

export const USER_STATUS_LABELS: Record<string, string> = getUserStatusLabels(tGlobal);

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
  if (!id) return tGlobal('common.notAvailable');
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
    telegramUserId:
      raw.telegramUserId == null || raw.telegramUserId === ''
        ? null
        : Number(raw.telegramUserId),
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
