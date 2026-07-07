import { apiRequest } from './api-client.js';

/** Учётная запись CRM в Mosquitto (фиксированная). */
export const MQTT_CRM_LOGIN = 'system';

export interface MqttBrokerSettingsValue {
  systemLogin?: string;
  systemPassword?: string;
}

let cached: MqttBrokerSettingsValue | null = null;
let expiresAt = 0;

export function invalidateMqttBrokerSettingsCache(): void {
  cached = null;
  expiresAt = 0;
}

function normalizeSettings(raw: unknown): MqttBrokerSettingsValue {
  if (!raw || typeof raw !== 'object') return {};
  const v = raw as Record<string, unknown>;
  return {
    systemLogin: v.systemLogin != null ? String(v.systemLogin) : undefined,
    systemPassword: v.systemPassword != null ? String(v.systemPassword) : undefined,
  };
}

export async function loadMqttBrokerSettings(): Promise<MqttBrokerSettingsValue> {
  if (cached && Date.now() < expiresAt) return cached;
  try {
    const rows = await apiRequest<Array<{ key: string; value: unknown }>>('GET', '/api/crm/settings?limit=50');
    const row = rows.find((s) => s.key === 'mqtt-broker');
    cached = normalizeSettings(row?.value);
  } catch {
    cached = {};
  }
  expiresAt = Date.now() + 60_000;
  return cached;
}

export async function loadMqttBrokerCredentials(): Promise<{ user: string; password: string }> {
  const settings = await loadMqttBrokerSettings();
  const password = settings.systemPassword?.trim() || process.env.MQTT_PASSWORD?.trim() || '';
  if (!password) {
    throw new Error('MQTT system password is not configured (settings mqtt-broker or MQTT_PASSWORD)');
  }
  return { user: MQTT_CRM_LOGIN, password };
}
