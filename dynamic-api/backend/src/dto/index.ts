import { Permission, UserStatus } from '../types';

export interface CreateUserDto {
  login: string;
  email: string;
  password: string;
  name: string;
  groupIds?: string[];
  status?: UserStatus;
}

export interface UpdateUserDto {
  login?: string;
  email?: string;
  password?: string;
  name?: string;
  groupIds?: string[];
  status?: UserStatus;
}

export interface LoginDto {
  login: string;
  password: string;
}

export interface RegisterDto {
  login: string;
  email: string;
  password: string;
  name: string;
}

export interface CreateGroupDto {
  name: string;
  description?: string;
  permissions: Permission[];
}

export interface UpdateGroupDto {
  name?: string;
  description?: string;
  permissions?: Permission[];
}

export interface CreateEndpointGroupDto {
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  order?: number;
  networkAccess?: {
    enabled?: boolean;
    allowedDomains?: string[];
    allowedIpRanges?: string[];
  };
}

export interface UpdateEndpointGroupDto {
  name?: string;
  description?: string;
  icon?: string;
  color?: string;
  order?: number;
  networkAccess?: {
    enabled?: boolean;
    allowedDomains?: string[];
    allowedIpRanges?: string[];
  };
}

export interface SchemaFieldDto {
  name: string;
  type: string;
  required?: boolean;
  description?: string;
  defaultValue?: unknown;
  order?: number;
  children?: SchemaFieldDto[];
  refEndpointId?: string;
}

export interface CreateEndpointDto {
  name: string;
  description?: string;
  slug: string;
  path: string;
  method: string;
  apiVersion?: string | null;
  groupId?: string;
  schema?: SchemaFieldDto[];
  accessType?: string;
  allowedGroupIds?: string[];
  networkAccess?: {
    enabled?: boolean;
    allowedDomains?: string[];
    allowedIpRanges?: string[];
  };
  inheritGroupNetworkAccess?: boolean;
  handlers?: { name: string; type: string; code?: string; enabled?: boolean }[];
  dataRetentionDays?: number | null;
}

export interface UpdateEndpointDto {
  name?: string;
  description?: string;
  slug?: string;
  path?: string;
  method?: string;
  apiVersion?: string | null;
  groupId?: string;
  schema?: SchemaFieldDto[];
  accessType?: string;
  allowedGroupIds?: string[];
  networkAccess?: {
    enabled?: boolean;
    allowedDomains?: string[];
    allowedIpRanges?: string[];
  };
  inheritGroupNetworkAccess?: boolean;
  handlers?: { name: string; type: string; code?: string; enabled?: boolean }[];
  enabled?: boolean;
  dataRetentionDays?: number | null;
}

export interface TestEndpointDto {
  method?: string;
  path?: string;
  headers?: Record<string, string>;
  body?: unknown;
  params?: Record<string, string>;
  query?: Record<string, string>;
  clientIp?: string;
  applyNetworkAccess?: boolean;
}
