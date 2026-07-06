import { env } from '../config/env';
import { userRepository, groupRepository, logRepository } from '../repositories';
import { hashPassword, comparePassword, signToken, verifyToken, sanitizeUser, getClientIp } from '../utils';
import { JwtPayload, Permission } from '../types';
import { LoginDto, RegisterDto } from '../dto';
import { IGroup, IUser } from '../models';
import { notifyAuthEvent } from './wash-notify.service';

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

export class AuthService {
  async login(dto: LoginDto, req: { ip?: string; headers: Record<string, unknown> }) {
    const user = await userRepository.findByLogin(dto.login);
    if (!user) throw new Error('Invalid credentials');
    if (user.status !== 'active') throw new Error('Account is not active');

    const valid = await comparePassword(dto.password, user.password);
    if (!valid) throw new Error('Invalid credentials');

    const groups = await groupRepository.findAll();
    const permissions = resolveUserPermissions(user, groups);

    const payload: JwtPayload = {
      userId: user._id.toString(),
      login: user.login,
      email: user.email,
      groupIds: user.groupIds.map(normalizeGroupId),
      permissions,
    };

    const accessToken = signToken(payload, env.jwtSecret, env.jwtExpiresIn);
    const refreshToken = signToken({ userId: user._id.toString() }, env.jwtRefreshSecret, env.jwtRefreshExpiresIn);

    await userRepository.update(user._id.toString(), {
      refreshToken,
      lastLoginAt: new Date(),
    });

    await logRepository.create({
      action: 'login',
      userId: user._id,
      message: `User ${user.login} logged in`,
      ip: getClientIp(req),
      userAgent: req.headers['user-agent'] as string,
    });

    void notifyAuthEvent('user_login', `Вход в систему: ${user.login} (${user.email})`);

    return {
      accessToken,
      refreshToken,
      user: sanitizeUser(user.toObject()),
    };
  }

  async register(dto: RegisterDto, req: { ip?: string; headers: Record<string, unknown> }) {
    const existing = await userRepository.findByLogin(dto.login);
    if (existing) throw new Error('Login already exists');

    const existingEmail = await userRepository.findByEmail(dto.email);
    if (existingEmail) throw new Error('Email already exists');

    const userGroup = await groupRepository.findByName('User');
    const hashedPassword = await hashPassword(dto.password);

    const user = await userRepository.create({
      login: dto.login.toLowerCase(),
      email: dto.email.toLowerCase(),
      password: hashedPassword,
      name: dto.name,
      groupIds: userGroup ? [userGroup._id] : [],
      status: 'active',
    });

    await logRepository.create({
      action: 'register',
      userId: user._id,
      message: `User ${user.login} registered`,
      ip: getClientIp(req),
    });

    return sanitizeUser(user.toObject());
  }

  async refresh(refreshToken: string) {
    const decoded = verifyToken<{ userId: string }>(refreshToken, env.jwtRefreshSecret);
    const user = await userRepository.findById(decoded.userId);
    if (!user || user.refreshToken !== refreshToken) throw new Error('Invalid refresh token');

    const groups = await groupRepository.findAll();
    const permissions = resolveUserPermissions(user, groups);

    const payload: JwtPayload = {
      userId: user._id.toString(),
      login: user.login,
      email: user.email,
      groupIds: user.groupIds.map(normalizeGroupId),
      permissions,
    };

    const accessToken = signToken(payload, env.jwtSecret, env.jwtExpiresIn);
    return { accessToken };
  }

  async logout(userId: string, req: { ip?: string; headers: Record<string, unknown> }) {
    await userRepository.update(userId, { refreshToken: undefined });
    await logRepository.create({
      action: 'logout',
      userId: userId as unknown as import('mongoose').Types.ObjectId,
      message: 'User logged out',
      ip: getClientIp(req),
    });
    void notifyAuthEvent('user_logout', `Выход из системы (userId: ${userId})`);
  }

  verifyAccessToken(token: string): JwtPayload {
    return verifyToken<JwtPayload>(token, env.jwtSecret);
  }
}

export const authService = new AuthService();
