import { describe, expect, it } from 'vitest';
import {
  validateDataAgainstSchema,
  applyDefaults,
  matchDynamicPath,
  getEndpointMatchPaths,
  getVersionedApiPath,
  normalizePath,
  sanitizeUser,
  getClientIp,
} from './index';
import { SchemaField } from '../types';

const schema: SchemaField[] = [
  { name: 'title', type: 'string', required: true, order: 0 },
  { name: 'count', type: 'number', required: false, order: 1 },
  { name: 'active', type: 'boolean', required: false, order: 2 },
  { name: 'tags', type: 'array', required: false, order: 3 },
  { name: 'refId', type: 'reference', required: false, order: 4, refEndpointId: '507f1f77bcf86cd799439011' },
];

describe('validateDataAgainstSchema', () => {
  it('rejects missing required fields', () => {
    const result = validateDataAgainstSchema({ count: 1 }, schema);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Field "title" is required');
  });

  it('rejects wrong types', () => {
    const result = validateDataAgainstSchema({ title: 'ok', count: 'bad' }, schema);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('count'))).toBe(true);
  });

  it('rejects unknown fields at runtime', () => {
    const result = validateDataAgainstSchema({ title: 'ok', injected: true }, schema);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Unknown field "injected"');
  });

  it('validates reference ObjectId format', () => {
    const bad = validateDataAgainstSchema({ title: 'ok', refId: 'not-an-id' }, schema);
    expect(bad.valid).toBe(false);

    const good = validateDataAgainstSchema({ title: 'ok', refId: '507f1f77bcf86cd799439011' }, schema);
    expect(good.valid).toBe(true);
  });

  it('accepts valid payload', () => {
    const result = validateDataAgainstSchema(
      { title: 'Item', count: 2, active: true, tags: ['a'] },
      schema
    );
    expect(result.valid).toBe(true);
  });

  it('allows partial PATCH without required fields', () => {
    const result = validateDataAgainstSchema({ count: 2 }, schema, { partial: true });
    expect(result.valid).toBe(true);
  });
});

describe('applyDefaults', () => {
  it('fills default values', () => {
    const fields: SchemaField[] = [
      { name: 'status', type: 'string', required: false, order: 0, defaultValue: 'new' },
    ];
    expect(applyDefaults({}, fields)).toEqual({ status: 'new' });
  });
});

describe('path utilities', () => {
  it('matches dynamic path params', () => {
    const { match, params } = matchDynamicPath('/api/products/:id', '/api/products/42');
    expect(match).toBe(true);
    expect(params.id).toBe('42');
  });

  it('normalizes paths', () => {
    expect(normalizePath('api/users/')).toBe('/api/users');
  });

  it('adds versioned paths', () => {
    const paths = getEndpointMatchPaths('/api/users', 'v1');
    expect(paths).toContain('/api/users');
    expect(paths).toContain('/api/v1/users');
  });

  it('builds versioned api path', () => {
    expect(getVersionedApiPath('/api/users', 'v1')).toBe('/api/v1/users');
    expect(getVersionedApiPath('/api/users', '2')).toBe('/api/v2/users');
    expect(getVersionedApiPath('/api/v1/users', 'v1')).toBe('/api/v1/users');
    expect(getVersionedApiPath('/api/users')).toBe('/api/users');
  });
});

describe('security helpers', () => {
  it('strips sensitive user fields', () => {
    const clean = sanitizeUser({ login: 'a', password: 'secret', refreshToken: 'rt' });
    expect(clean).toEqual({ login: 'a' });
  });

  it('reads client IP from x-forwarded-for', () => {
    const ip = getClientIp({ ip: '10.0.0.1', headers: { 'x-forwarded-for': '203.0.113.5, 10.0.0.1' } });
    expect(ip).toBe('203.0.113.5');
  });
});
