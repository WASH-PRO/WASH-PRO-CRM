import { describe, expect, it } from 'vitest';
import { buildMqttAclFile } from '../src/mqtt-acl.js';
import { extractNativeTopicSerial, resolveTrustedPostSerial } from '../src/mqtt-post-bindings.js';

describe('buildMqttAclFile', () => {
  it('grants system full access and isolates post logins by serial', () => {
    const acl = buildMqttAclFile('system', [{ mqttLogin: 'WP-001', serialNumber: 'WP-001' }], 'washpro');
    expect(acl).toContain('user system');
    expect(acl).toContain('topic readwrite #');
    expect(acl).toContain('user WP-001');
    expect(acl).toContain('topic read washpro/WP-001/#');
    expect(acl).toContain('topic write +/WP-001/#');
  });
});

describe('mqtt-post-bindings', () => {
  it('extracts serial from native topic', () => {
    expect(extractNativeTopicSerial('washpro/WP-001/state/process')).toBe('WP-001');
    expect(extractNativeTopicSerial('wash/telemetry/foo')).toBeNull();
  });

  it('prefers topic serial over mismatched payload serial', () => {
    const serial = resolveTrustedPostSerial('washpro/WP-001/state/process', {
      postSerial: 'WP-999',
    });
    expect(serial).toBe('WP-001');
  });
});
