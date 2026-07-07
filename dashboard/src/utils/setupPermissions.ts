import type { Permission, User } from '../types';

export function canManageSystemSetup(permissions: Permission[] | undefined): boolean {
  if (!permissions?.length) return false;
  return permissions.includes('update') || permissions.includes('delete') || permissions.includes('manage_users');
}

export function canCreateWash(permissions: Permission[] | undefined): boolean {
  return Boolean(permissions?.includes('create'));
}

export function canUpdateWash(permissions: Permission[] | undefined): boolean {
  return Boolean(permissions?.includes('update'));
}

export function canDeleteWash(permissions: Permission[] | undefined): boolean {
  return Boolean(permissions?.includes('delete'));
}

export function canCreatePost(permissions: Permission[] | undefined): boolean {
  return Boolean(permissions?.includes('create'));
}

export function canUpdateCurrency(permissions: Permission[] | undefined): boolean {
  return Boolean(permissions?.includes('update'));
}

export function canSyncMqtt(permissions: Permission[] | undefined): boolean {
  return canManageSystemSetup(permissions);
}

export function isReadOnlySetupUser(user: User | null): boolean {
  if (!user?.permissions?.length) return true;
  return !canManageSystemSetup(user.permissions);
}

export function setupRoleHint(user: User | null): string {
  if (!user) return '';
  if (canManageSystemSetup(user.permissions)) return 'Настройка системы';
  if (user.permissions?.includes('view')) return 'Только просмотр';
  return 'Ограниченный доступ';
}
