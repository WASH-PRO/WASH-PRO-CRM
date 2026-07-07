import { userRepository, groupRepository, logRepository } from '../repositories';
import { hashPassword, sanitizeUser } from '../utils';
import { CreateUserDto, UpdateUserDto } from '../dto';
import { webhookService } from './webhook.service';
import { notifyAuthEvent } from './wash-notify.service';
import { IGroup, IUser } from '../models';
import { Permission } from '../types';

function isPopulatedGroup(groupId: unknown): groupId is IGroup {
  return typeof groupId === 'object' && groupId !== null && 'permissions' in groupId && 'name' in groupId;
}

function normalizeGroupId(groupId: unknown): string {
  if (isPopulatedGroup(groupId)) {
    return groupId._id.toString();
  }
  return String(groupId);
}

function resolveUserPermissions(user: IUser, groups: IGroup[]): Permission[] {
  const groupIds = user.groupIds as unknown[];
  if (groupIds.length > 0 && isPopulatedGroup(groupIds[0])) {
    return [...new Set(groupIds.filter(isPopulatedGroup).flatMap((group) => group.permissions))] as Permission[];
  }

  const userGroupIds = new Set(groupIds.map(normalizeGroupId));
  const userGroups = groups.filter((group) => userGroupIds.has(group._id.toString()));
  return [...new Set(userGroups.flatMap((group) => group.permissions))] as Permission[];
}

function normalizeTelegramUserId(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const num = Number(value);
  if (!Number.isInteger(num) || num <= 0) {
    throw new Error('telegramUserId must be a positive integer');
  }
  return num;
}

async function assertTelegramUserIdAvailable(telegramUserId: number | null | undefined, excludeUserId?: string) {
  if (telegramUserId == null) return;
  const existing = await userRepository.findByTelegramUserId(telegramUserId);
  if (existing && existing._id.toString() !== excludeUserId) {
    throw new Error('Telegram user id is already linked to another account');
  }
}

export class UserService {
  async getAll(page = 1, limit = 20, search?: string) {
    const result = await userRepository.findAll(page, limit, search);
    return {
      ...result,
      data: result.data.map((u) => sanitizeUser(u.toObject())),
    };
  }

  async getById(id: string) {
    const user = await userRepository.findById(id);
    if (!user) throw new Error('User not found');
    return sanitizeUser(user.toObject());
  }

  async create(dto: CreateUserDto, createdBy?: string) {
    const existing = await userRepository.findByLogin(dto.login);
    if (existing) throw new Error('Login already exists');

    const telegramUserId = normalizeTelegramUserId(dto.telegramUserId);
    await assertTelegramUserIdAvailable(telegramUserId);

    const hashedPassword = await hashPassword(dto.password);
    const user = await userRepository.create({
      login: dto.login.toLowerCase(),
      email: dto.email.toLowerCase(),
      password: hashedPassword,
      name: dto.name,
      groupIds: dto.groupIds as unknown as import('mongoose').Types.ObjectId[],
      status: dto.status || 'active',
      telegramUserId: telegramUserId ?? undefined,
    });

    await logRepository.create({
      action: 'user_create',
      userId: createdBy as unknown as import('mongoose').Types.ObjectId,
      message: `User ${user.login} created`,
      details: { userId: user._id.toString() },
    });

    void webhookService.dispatch('user.created', {
      userId: user._id.toString(),
      login: user.login,
      email: user.email,
    });

    void notifyAuthEvent('user_created', `Создан пользователь: ${user.login} (${user.email})`);

    return sanitizeUser(user.toObject());
  }

  async update(id: string, dto: UpdateUserDto, updatedBy?: string) {
    const passwordChanged = Boolean(dto.password);
    const telegramUserId = normalizeTelegramUserId(dto.telegramUserId);
    await assertTelegramUserIdAvailable(telegramUserId, id);

    const updateData: Record<string, unknown> = { ...dto };
    if (dto.password) {
      updateData.password = await hashPassword(dto.password);
    }
    delete updateData.groupIds;
    if (dto.groupIds) {
      updateData.groupIds = dto.groupIds;
    }
    if (dto.telegramUserId !== undefined) {
      updateData.telegramUserId = telegramUserId;
    }

    const user = await userRepository.update(id, updateData);
    if (!user) throw new Error('User not found');

    await logRepository.create({
      action: 'user_update',
      userId: updatedBy as unknown as import('mongoose').Types.ObjectId,
      message: `User ${user.login} updated`,
      details: { userId: id },
    });

    void webhookService.dispatch('user.updated', { userId: id, login: user.login });

    if (passwordChanged) {
      void notifyAuthEvent('user_password_changed', `Изменён пароль пользователя: ${user.login}`);
    } else {
      void notifyAuthEvent('user_updated', `Изменён пользователь: ${user.login}`);
    }

    return sanitizeUser(user.toObject());
  }

  async delete(id: string, deletedBy?: string) {
    const user = await userRepository.findById(id);
    if (!user) throw new Error('User not found');

    await userRepository.delete(id);

    await logRepository.create({
      action: 'user_delete',
      userId: deletedBy as unknown as import('mongoose').Types.ObjectId,
      message: `User ${user.login} deleted`,
      details: { userId: id },
    });

    void webhookService.dispatch('user.deleted', { userId: id, login: user.login });
    void notifyAuthEvent('user_deleted', `Удалён пользователь: ${user.login}`);
  }

  async getProfile(userId: string) {
    return this.getById(userId);
  }

  async updateProfile(userId: string, dto: UpdateUserDto) {
    const { groupIds, status, ...rest } = dto;
    return this.update(userId, rest, userId);
  }

  async resolveTelegramAuth(telegramUserIdRaw: string) {
    const telegramUserId = Number(String(telegramUserIdRaw || '').trim());
    if (!Number.isInteger(telegramUserId) || telegramUserId <= 0) {
      return { authorized: false as const };
    }

    const user = await userRepository.findByTelegramUserId(telegramUserId);
    if (!user || user.status !== 'active') {
      return { authorized: false as const };
    }

    const groups = await groupRepository.findAll();
    const permissions = resolveUserPermissions(user, groups);
    return {
      authorized: true as const,
      userId: user._id.toString(),
      name: user.name,
      login: user.login,
      permissions,
    };
  }
}

export class GroupService {
  async getAll() {
    return groupRepository.findAll();
  }

  async getById(id: string) {
    const group = await groupRepository.findById(id);
    if (!group) throw new Error('Group not found');
    return group;
  }

  async create(dto: import('../dto').CreateGroupDto) {
    const existing = await groupRepository.findByName(dto.name);
    if (existing) throw new Error('Group already exists');
    return groupRepository.create({ ...dto, isSystem: false });
  }

  async update(id: string, dto: import('../dto').UpdateGroupDto) {
    const group = await groupRepository.findById(id);
    if (!group) throw new Error('Group not found');
    return groupRepository.update(id, dto);
  }

  async delete(id: string) {
    const deleted = await groupRepository.delete(id);
    if (!deleted) throw new Error('Cannot delete system group or group not found');
  }
}

export const userService = new UserService();
export const groupService = new GroupService();
