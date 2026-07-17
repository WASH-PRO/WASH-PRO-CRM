import { apiRequest, logger } from './api-client.js';

/** Учётная запись CRM в Mosquitto (фиксированная). */
export const MQTT_CRM_LOGIN = 'system';

/** Legacy seed default — must not stay when .env MQTT_PASSWORD was rotated. */
export const MQTT_SEED_DEFAULT_PASSWORD = 'washpro';

export interface MqttDeliverySettings {
  /** Срок хранения исходящих сообщений в outbox (часы). По умолчанию 168 (7 суток). */
  outboundRetentionHours?: number;
  /** Требовать подтверждение доставки от устройства (set/ack). */
  requireDeliveryConfirmation?: boolean;
  /** Повторно публиковать, если подтверждение не получено. */
  redeliverOnNoAck?: boolean;
  /** Интервал между повторами (сек). */
  redeliverIntervalSec?: number;
  /** Максимум попыток доставки (включая первую). */
  redeliverMaxAttempts?: number;
}

export interface MqttBrokerSettingsValue extends MqttDeliverySettings {
  systemLogin?: string;
  systemPassword?: string;
}

export const DEFAULT_MQTT_DELIVERY: Required<MqttDeliverySettings> = {
  outboundRetentionHours: 168,
  requireDeliveryConfirmation: false,
  redeliverOnNoAck: false,
  redeliverIntervalSec: 30,
  redeliverMaxAttempts: 5,
};

let cached: MqttBrokerSettingsValue | null = null;
let expiresAt = 0;

export function invalidateMqttBrokerSettingsCache(): void {
  cached = null;
  expiresAt = 0;
}

function toBool(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (value === '1' || value === 1 || value === 'true') return true;
  if (value === '0' || value === 0 || value === 'false') return false;
  return fallback;
}

function toPositiveInt(value: unknown, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

function normalizeSettings(raw: unknown): MqttBrokerSettingsValue {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_MQTT_DELIVERY };
  const v = raw as Record<string, unknown>;
  return {
    systemLogin: v.systemLogin != null ? String(v.systemLogin) : undefined,
    systemPassword: v.systemPassword != null ? String(v.systemPassword) : undefined,
    outboundRetentionHours: toPositiveInt(v.outboundRetentionHours, DEFAULT_MQTT_DELIVERY.outboundRetentionHours),
    requireDeliveryConfirmation: toBool(
      v.requireDeliveryConfirmation,
      DEFAULT_MQTT_DELIVERY.requireDeliveryConfirmation
    ),
    redeliverOnNoAck: toBool(v.redeliverOnNoAck, DEFAULT_MQTT_DELIVERY.redeliverOnNoAck),
    redeliverIntervalSec: toPositiveInt(v.redeliverIntervalSec, DEFAULT_MQTT_DELIVERY.redeliverIntervalSec),
    redeliverMaxAttempts: toPositiveInt(v.redeliverMaxAttempts, DEFAULT_MQTT_DELIVERY.redeliverMaxAttempts),
  };
}

export async function loadMqttBrokerSettings(): Promise<MqttBrokerSettingsValue> {
  if (cached && Date.now() < expiresAt) return cached;
  try {
    const rows = await apiRequest<Array<{ key: string; value: unknown }>>('GET', '/api/crm/settings?limit=50');
    const row = rows.find((s) => s.key === 'mqtt-broker');
    cached = normalizeSettings(row?.value);
  } catch {
    cached = { ...DEFAULT_MQTT_DELIVERY };
  }
  expiresAt = Date.now() + 60_000;
  return cached;
}

/**
 * If CRM still has the seed password `washpro` (or empty) while `.env` has a real
 * MQTT_PASSWORD, upgrade settings so Mosquitto passwd sync and the processor agree.
 * Custom passwords set in Settings → MQTT are left alone.
 */
export async function reconcileMqttSystemPasswordFromEnv(): Promise<boolean> {
  const envPass = process.env.MQTT_PASSWORD?.trim() || '';
  if (!envPass) return false;

  let rows: Array<{ id: string; key: string; value: unknown }>;
  try {
    rows = await apiRequest('GET', '/api/crm/settings?limit=50');
  } catch {
    return false;
  }

  const row = rows.find((s) => s.key === 'mqtt-broker');
  if (!row?.id) return false;

  const value = normalizeSettings(row.value);
  const current = value.systemPassword?.trim() || '';
  if (current === envPass) return false;

  if (current && current !== MQTT_SEED_DEFAULT_PASSWORD) {
    logger.warn(
      {
        settingsLen: current.length,
        envLen: envPass.length,
      },
      'mqtt-broker.systemPassword differs from MQTT_PASSWORD — CRM settings take precedence'
    );
    return false;
  }

  const next: MqttBrokerSettingsValue = {
    ...value,
    systemLogin: value.systemLogin || MQTT_CRM_LOGIN,
    systemPassword: envPass,
  };
  await apiRequest('PUT', `/api/crm/settings/${row.id}`, { key: 'mqtt-broker', value: next });
  invalidateMqttBrokerSettingsCache();
  logger.info('Healed mqtt-broker.systemPassword from MQTT_PASSWORD (replaced empty/seed default)');
  return true;
}

export async function loadMqttBrokerCredentials(): Promise<{ user: string; password: string }> {
  const settings = await loadMqttBrokerSettings();
  const password = settings.systemPassword?.trim() || process.env.MQTT_PASSWORD?.trim() || '';
  if (!password) {
    throw new Error('MQTT system password is not configured (settings mqtt-broker or MQTT_PASSWORD)');
  }
  return { user: MQTT_CRM_LOGIN, password };
}
