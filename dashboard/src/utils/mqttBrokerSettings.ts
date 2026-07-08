import type { MqttBrokerSettings } from '../types';

export const MQTT_SYSTEM_LOGIN = 'system';

export const DEFAULT_MQTT_BROKER: MqttBrokerSettings = {
  systemLogin: MQTT_SYSTEM_LOGIN,
  systemPassword: '',
  outboundRetentionHours: 168,
  requireDeliveryConfirmation: false,
  redeliverOnNoAck: false,
  redeliverIntervalSec: 30,
  redeliverMaxAttempts: 5,
};

export function parseMqttBrokerSettings(raw: unknown): MqttBrokerSettings {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_MQTT_BROKER };
  const v = raw as Record<string, unknown>;
  const num = (key: string, fallback: number) => {
    const n = Number(v[key]);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
  };
  const bool = (key: string, fallback: boolean) => {
    if (typeof v[key] === 'boolean') return v[key];
    if (v[key] === '1' || v[key] === 1 || v[key] === 'true') return true;
    if (v[key] === '0' || v[key] === 0 || v[key] === 'false') return false;
    return fallback;
  };
  return {
    systemLogin: MQTT_SYSTEM_LOGIN,
    systemPassword: String(v.systemPassword ?? ''),
    outboundRetentionHours: num('outboundRetentionHours', DEFAULT_MQTT_BROKER.outboundRetentionHours),
    requireDeliveryConfirmation: bool('requireDeliveryConfirmation', DEFAULT_MQTT_BROKER.requireDeliveryConfirmation),
    redeliverOnNoAck: bool('redeliverOnNoAck', DEFAULT_MQTT_BROKER.redeliverOnNoAck),
    redeliverIntervalSec: num('redeliverIntervalSec', DEFAULT_MQTT_BROKER.redeliverIntervalSec),
    redeliverMaxAttempts: num('redeliverMaxAttempts', DEFAULT_MQTT_BROKER.redeliverMaxAttempts),
  };
}
