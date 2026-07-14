import { describe, expect, it } from 'vitest';
import { EndpointData } from '../models/EndpointData';

function indexKeysEqual(
  a: Record<string, number>,
  b: Record<string, number>
): boolean {
  const aKeys = Object.keys(a).sort();
  const bKeys = Object.keys(b).sort();
  return aKeys.length === bKeys.length && aKeys.every((key, i) => key === bKeys[i] && a[key] === b[key]);
}

describe('EndpointData indexes', () => {
  it('declares telemetry list and count indexes', () => {
    const indexes = EndpointData.schema.indexes().map(([spec]) => spec as Record<string, number>);

    expect(
      indexes.some((spec) =>
        indexKeysEqual(spec, {
          resourcePath: 1,
          'data.postSerial': 1,
          'data.receivedAt': -1,
        })
      )
    ).toBe(true);

    expect(
      indexes.some((spec) =>
        indexKeysEqual(spec, {
          resourcePath: 1,
          'data.postSerial': 1,
          'data.messageType': 1,
          'data.receivedAt': -1,
        })
      )
    ).toBe(true);
  });

  it('declares post-states lookup index', () => {
    const indexes = EndpointData.schema.indexes().map(([spec]) => spec as Record<string, number>);

    expect(
      indexes.some((spec) =>
        indexKeysEqual(spec, {
          resourcePath: 1,
          'data.postId': 1,
          'data.lastMessageAt': -1,
        })
      )
    ).toBe(true);
  });
});
