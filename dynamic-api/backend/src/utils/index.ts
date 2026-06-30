import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { SchemaField, FieldType, ExamplePayload } from '../types';
import { findUnknownFields } from './schema';

export { findUnknownFields, pickSchemaData } from './schema';

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signToken(payload: object, secret: string, expiresIn: string): string {
  return jwt.sign(payload, secret, { expiresIn } as jwt.SignOptions);
}

export function verifyToken<T>(token: string, secret: string): T {
  return jwt.verify(token, secret) as T;
}

export function getCollectionPath(path: string): string {
  const normalized = normalizePath(path);
  const withoutParams = normalized.replace(/\/:[^/]+/g, '');
  return withoutParams || normalized;
}

export function generateExampleValue(type: FieldType): unknown {
  switch (type) {
    case 'string':
      return 'example string';
    case 'number':
      return 42;
    case 'boolean':
      return true;
    case 'datetime':
      return new Date().toISOString();
    case 'json':
      return { key: 'value' };
    case 'array':
      return ['item1', 'item2'];
    case 'object':
      return { nested: 'value' };
    case 'reference':
      return '507f1f77bcf86cd799439011';
    default:
      return null;
  }
}

export function generateExampleFromSchema(fields: SchemaField[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const sorted = [...fields].sort((a, b) => a.order - b.order);

  for (const field of sorted) {
    if (field.type === 'object' && field.children?.length) {
      result[field.name] = generateExampleFromSchema(field.children);
    } else {
      result[field.name] = field.defaultValue ?? generateExampleValue(field.type);
    }
  }

  return result;
}

export function generateExamples(schema: SchemaField[]): ExamplePayload {
  const example = generateExampleFromSchema(schema);
  return {
    request: example,
    response: { success: true, data: { id: uuidv4(), ...example } },
  };
}

export function validateDataAgainstSchema(
  data: Record<string, unknown>,
  schema: SchemaField[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const field of schema) {
    const value = data[field.name];

    if (field.required && (value === undefined || value === null || value === '')) {
      errors.push(`Field "${field.name}" is required`);
      continue;
    }

    if (value === undefined || value === null) continue;

    switch (field.type) {
      case 'string':
        if (typeof value !== 'string') errors.push(`Field "${field.name}" must be a string`);
        break;
      case 'number':
        if (typeof value !== 'number') errors.push(`Field "${field.name}" must be a number`);
        break;
      case 'boolean':
        if (typeof value !== 'boolean') errors.push(`Field "${field.name}" must be a boolean`);
        break;
      case 'array':
        if (!Array.isArray(value)) errors.push(`Field "${field.name}" must be an array`);
        break;
      case 'object':
        if (typeof value !== 'object' || Array.isArray(value)) {
          errors.push(`Field "${field.name}" must be an object`);
        } else if (field.children?.length) {
          const nested = validateDataAgainstSchema(value as Record<string, unknown>, field.children);
          errors.push(...nested.errors.map((e) => `${field.name}.${e}`));
        }
        break;
      case 'datetime':
        if (isNaN(Date.parse(String(value)))) errors.push(`Field "${field.name}" must be a valid datetime`);
        break;
      case 'json':
        break;
      case 'reference':
        if (typeof value !== 'string') {
          errors.push(`Field "${field.name}" must be a reference ID string`);
        } else if (!/^[a-f\d]{24}$/i.test(value)) {
          errors.push(`Field "${field.name}" must be a valid record ID`);
        } else if (!field.refEndpointId) {
          errors.push(`Field "${field.name}" must specify a target endpoint`);
        }
        break;
    }
  }

  errors.push(...findUnknownFields(data, schema));

  return { valid: errors.length === 0, errors };
}

const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;

export async function validateReferences(
  data: Record<string, unknown>,
  schema: SchemaField[],
  resolveEndpoint: (id: string) => Promise<{ path: string } | null>,
  resolveRecord: (id: string) => Promise<{ resourcePath: string } | null>
): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];

  for (const field of schema) {
    if (field.type !== 'reference') continue;

    const value = data[field.name];
    if (value === undefined || value === null || value === '') continue;

    if (typeof value !== 'string' || !OBJECT_ID_PATTERN.test(value)) {
      errors.push(`Field "${field.name}" must be a valid record ID`);
      continue;
    }

    if (!field.refEndpointId) {
      errors.push(`Field "${field.name}" must specify a target endpoint`);
      continue;
    }

    const refEndpoint = await resolveEndpoint(field.refEndpointId);
    if (!refEndpoint) {
      errors.push(`Field "${field.name}" references unknown endpoint`);
      continue;
    }

    const record = await resolveRecord(value);
    const collectionPath = getCollectionPath(refEndpoint.path);
    if (!record || record.resourcePath !== collectionPath) {
      errors.push(`Field "${field.name}" references non-existent record`);
    }
  }

  return { valid: errors.length === 0, errors };
}

export function applyDefaults(data: Record<string, unknown>, schema: SchemaField[]): Record<string, unknown> {
  const result = { ...data };

  for (const field of schema) {
    if (result[field.name] === undefined && field.defaultValue !== undefined) {
      result[field.name] = field.defaultValue;
    }
    if (field.type === 'object' && field.children?.length && typeof result[field.name] === 'object') {
      result[field.name] = applyDefaults(result[field.name] as Record<string, unknown>, field.children);
    }
  }

  return result;
}

export function normalizePath(path: string): string {
  let normalized = path.trim();
  if (!normalized.startsWith('/')) normalized = `/${normalized}`;
  if (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}

export function matchDynamicPath(pattern: string, requestPath: string): { match: boolean; params: Record<string, string> } {
  const patternParts = normalizePath(pattern).split('/').filter(Boolean);
  const requestParts = normalizePath(requestPath).split('/').filter(Boolean);

  if (patternParts.length !== requestParts.length) {
    return { match: false, params: {} };
  }

  const params: Record<string, string> = {};

  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(':')) {
      params[patternParts[i].slice(1)] = requestParts[i];
    } else if (patternParts[i] !== requestParts[i]) {
      return { match: false, params: {} };
    }
  }

  return { match: true, params };
}

export function getVersionedApiPath(path: string, apiVersion?: string): string {
  const normalized = normalizePath(path);
  const version = apiVersion?.trim();
  if (!version) return normalized;
  const v = version.startsWith('v') ? version : `v${version}`;
  if (normalized.includes(`/api/${v}/`)) return normalized;
  return normalized.replace(/^\/api\//, `/api/${v}/`);
}

export function getEndpointMatchPaths(path: string, apiVersion?: string): string[] {
  const normalized = normalizePath(path);
  const paths = new Set<string>([normalized]);
  const versioned = getVersionedApiPath(path, apiVersion);
  if (versioned !== normalized) {
    paths.add(versioned);
  }
  return [...paths];
}

export function sanitizeUser(user: Record<string, unknown>): Record<string, unknown> {
  const { password, refreshToken, ...rest } = user;
  return rest;
}

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function buildTextSearchFilter(
  search: string | undefined,
  fields: string[]
): Record<string, unknown> | undefined {
  const q = search?.trim();
  if (!q) return undefined;
  const regex = new RegExp(escapeRegex(q), 'i');
  return { $or: fields.map((field) => ({ [field]: regex })) };
}

export {
  normalizeNetworkAccessInput,
  validateNetworkAccessInput,
  resolveEffectiveNetworkAccess,
  checkNetworkAccess,
  matchDomain,
  matchIpRange,
  extractRequestDomain,
} from './networkAccess';

export function getClientIp(req: { ip?: string; headers: Record<string, unknown> }): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.ip || 'unknown';
}
