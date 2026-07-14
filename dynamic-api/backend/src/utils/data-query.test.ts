import { describe, expect, it } from 'vitest';
import { buildDataMongoFilter, parseListQueryFilters } from './data-query';

describe('buildDataMongoFilter', () => {
  it('maps plain fields to data.*', () => {
    expect(buildDataMongoFilter({ postSerial: 'WP-1' })).toEqual({ 'data.postSerial': 'WP-1' });
  });

  it('preserves operators', () => {
    expect(buildDataMongoFilter({ messageType: { $in: ['state', 'process'] } })).toEqual({
      'data.messageType': { $in: ['state', 'process'] },
    });
  });
});

describe('parseListQueryFilters', () => {
  it('parses pagination-adjacent filters and sort', () => {
    const parsed = parseListQueryFilters({
      page: '2',
      limit: '50',
      postSerial: 'WP-1',
      messageType: 'state,process',
      sort: 'receivedAt',
      sortDir: 'desc',
    });
    expect(parsed.sortField).toBe('receivedAt');
    expect(parsed.sortDir).toBe('desc');
    expect(parsed.dataFilter).toEqual({
      postSerial: 'WP-1',
      messageType: { $in: ['state', 'process'] },
    });
  });

  it('parses date range suffixes', () => {
    const parsed = parseListQueryFilters({
      receivedAtFrom: '2026-01-01',
      receivedAtTo: '2026-01-31T23:59:59.999Z',
    });
    expect(parsed.dataFilter).toEqual({
      receivedAt: { $gte: '2026-01-01', $lte: '2026-01-31T23:59:59.999Z' },
    });
  });
});
