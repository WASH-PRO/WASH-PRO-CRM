export type Permission =
  | 'view'
  | 'create'
  | 'update'
  | 'delete'
  | 'manage_users'
  | 'manage_api'
  | 'view_logs';

export type FieldType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'object'
  | 'array'
  | 'datetime'
  | 'json';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type AccessType = 'public' | 'authenticated' | 'group';

export type UserStatus = 'active' | 'inactive' | 'suspended';

export type LogAction =
  | 'login'
  | 'logout'
  | 'register'
  | 'error'
  | 'endpoint_create'
  | 'endpoint_update'
  | 'endpoint_delete'
  | 'api_call'
  | 'user_create'
  | 'user_update'
  | 'user_delete';

export interface SchemaField {
  name: string;
  type: FieldType;
  required: boolean;
  description?: string;
  defaultValue?: unknown;
  order: number;
  children?: SchemaField[];
}

export interface EndpointHandler {
  name: string;
  type: 'pre' | 'post' | 'transform';
  code?: string;
  enabled: boolean;
}

export interface JwtPayload {
  userId: string;
  login: string;
  email: string;
  groupIds: string[];
  permissions: Permission[];
}


export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface DashboardStats {
  users: number;
  endpoints: number;
  requests: number;
  errors: number;
  groups: number;
  activeUsers: number;
  requestsOverTime: { date: string; count: number }[];
  errorsOverTime: { date: string; count: number }[];
  userActivity: { date: string; count: number }[];
}

export interface TestEndpointResult {
  request: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body?: unknown;
    params?: Record<string, string>;
  };
  response: {
    statusCode: number;
    headers: Record<string, string>;
    body: unknown;
    responseTime: number;
  };
}

export interface ExamplePayload {
  request: Record<string, unknown>;
  response: Record<string, unknown>;
}
