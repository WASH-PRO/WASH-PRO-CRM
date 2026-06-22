import { userRepository, groupRepository, logRepository } from '../repositories';
import { hashPassword, sanitizeUser } from '../utils';
import { CreateUserDto, UpdateUserDto } from '../dto';

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

    const hashedPassword = await hashPassword(dto.password);
    const user = await userRepository.create({
      login: dto.login.toLowerCase(),
      email: dto.email.toLowerCase(),
      password: hashedPassword,
      name: dto.name,
      groupIds: dto.groupIds as unknown as import('mongoose').Types.ObjectId[],
      status: dto.status || 'active',
    });

    await logRepository.create({
      action: 'user_create',
      userId: createdBy as unknown as import('mongoose').Types.ObjectId,
      message: `User ${user.login} created`,
      details: { userId: user._id.toString() },
    });

    return sanitizeUser(user.toObject());
  }

  async update(id: string, dto: UpdateUserDto, updatedBy?: string) {
    const updateData: Record<string, unknown> = { ...dto };
    if (dto.password) {
      updateData.password = await hashPassword(dto.password);
    }
    delete updateData.groupIds;
    if (dto.groupIds) {
      updateData.groupIds = dto.groupIds;
    }

    const user = await userRepository.update(id, updateData);
    if (!user) throw new Error('User not found');

    await logRepository.create({
      action: 'user_update',
      userId: updatedBy as unknown as import('mongoose').Types.ObjectId,
      message: `User ${user.login} updated`,
      details: { userId: id },
    });

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
  }

  async getProfile(userId: string) {
    return this.getById(userId);
  }

  async updateProfile(userId: string, dto: UpdateUserDto) {
    const { groupIds, status, ...rest } = dto;
    return this.update(userId, rest, userId);
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
