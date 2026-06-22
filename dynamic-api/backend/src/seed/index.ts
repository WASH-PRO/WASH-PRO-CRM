import { Group, User, Endpoint, EndpointGroup } from '../models';
import { hashPassword } from '../utils';
import { env } from '../config/env';
import { Permission } from '../types';

const SYSTEM_GROUPS: { name: string; description: string; permissions: Permission[] }[] = [
  {
    name: 'Super Admin',
    description: 'Full system access',
    permissions: ['view', 'create', 'update', 'delete', 'manage_users', 'manage_api', 'view_logs'],
  },
  {
    name: 'Admin',
    description: 'Administrative access',
    permissions: ['view', 'create', 'update', 'delete', 'manage_users', 'manage_api', 'view_logs'],
  },
  {
    name: 'Editor',
    description: 'Can create and edit endpoints',
    permissions: ['view', 'create', 'update', 'manage_api'],
  },
  {
    name: 'Manager',
    description: 'Can manage endpoints and view logs',
    permissions: ['view', 'create', 'update', 'manage_api', 'view_logs'],
  },
  {
    name: 'User',
    description: 'Basic user access',
    permissions: ['view'],
  },
];

const SYSTEM_ENDPOINTS = [
  {
    name: 'Login',
    description: 'Authenticate user and receive JWT tokens',
    slug: 'auth-login',
    path: '/api/auth/login',
    method: 'POST' as const,
    fields: [
      { name: 'login', type: 'string' as const, required: true, order: 0, description: 'User login' },
      { name: 'password', type: 'string' as const, required: true, order: 1, description: 'User password' },
    ],
    accessType: 'public' as const,
  },
  {
    name: 'Logout',
    description: 'Invalidate user session',
    slug: 'auth-logout',
    path: '/api/auth/logout',
    method: 'POST' as const,
    fields: [],
    accessType: 'authenticated' as const,
  },
  {
    name: 'Refresh Token',
    description: 'Refresh JWT access token',
    slug: 'auth-refresh',
    path: '/api/auth/refresh',
    method: 'POST' as const,
    fields: [
      { name: 'refreshToken', type: 'string' as const, required: true, order: 0 },
    ],
    accessType: 'public' as const,
  },
  {
    name: 'Register',
    description: 'Register a new user account',
    slug: 'auth-register',
    path: '/api/auth/register',
    method: 'POST' as const,
    fields: [
      { name: 'login', type: 'string' as const, required: true, order: 0 },
      { name: 'email', type: 'string' as const, required: true, order: 1 },
      { name: 'password', type: 'string' as const, required: true, order: 2 },
      { name: 'name', type: 'string' as const, required: true, order: 3 },
    ],
    accessType: 'public' as const,
  },
  {
    name: 'List Users',
    description: 'Get all users',
    slug: 'users-list',
    path: '/api/users',
    method: 'GET' as const,
    fields: [],
    accessType: 'group' as const,
  },
  {
    name: 'List Groups',
    description: 'Get all user groups',
    slug: 'groups-list',
    path: '/api/groups',
    method: 'GET' as const,
    fields: [],
    accessType: 'group' as const,
  },
  {
    name: 'User Profile',
    description: 'Get current user profile',
    slug: 'profile-get',
    path: '/api/profile',
    method: 'GET' as const,
    fields: [],
    accessType: 'authenticated' as const,
  },
];

const DEFAULT_ENDPOINT_GROUPS = [
  { name: 'CRM', description: 'Customer Relationship Management', icon: 'users', color: '#8b5cf6', order: 0 },
  { name: 'SHOP', description: 'E-commerce endpoints', icon: 'shopping-cart', color: '#10b981', order: 1 },
  { name: 'DEVICES', description: 'IoT device management', icon: 'cpu', color: '#f59e0b', order: 2 },
];

export async function seedDatabase(): Promise<void> {
  console.log('Seeding database...');

  for (const groupData of SYSTEM_GROUPS) {
    const existing = await Group.findOne({ name: groupData.name });
    if (!existing) {
      await Group.create({ ...groupData, isSystem: true });
      console.log(`  Created group: ${groupData.name}`);
    }
  }

  const superAdminGroup = await Group.findOne({ name: 'Super Admin' });

  const existingAdmin = await User.findOne({ login: env.adminLogin });
  if (!existingAdmin && superAdminGroup) {
    const hashedPassword = await hashPassword(env.adminPassword);
    await User.create({
      login: env.adminLogin,
      email: env.adminEmail,
      password: hashedPassword,
      name: 'Super Administrator',
      status: 'active',
      groupIds: [superAdminGroup._id],
    });
    console.log(`  Created admin user: ${env.adminLogin}`);
  }

  for (const epData of SYSTEM_ENDPOINTS) {
    const existing = await Endpoint.findOne({ path: epData.path, method: epData.method });
    if (!existing) {
      await Endpoint.create({
        ...epData,
        isSystem: true,
        enabled: true,
        handlers: [],
        allowedGroupIds: [],
      });
      console.log(`  Created system endpoint: ${epData.method} ${epData.path}`);
    }
  }

  for (const groupData of DEFAULT_ENDPOINT_GROUPS) {
    const existing = await EndpointGroup.findOne({ name: groupData.name });
    if (!existing) {
      await EndpointGroup.create(groupData);
      console.log(`  Created endpoint group: ${groupData.name}`);
    }
  }

  const { settingsService } = await import('../services/settings.service');
  await settingsService.seedDefaults();

  console.log('Database seeding complete');
}
