import type { MqttBrokerSettings } from '../types';

export const MQTT_SYSTEM_LOGIN = 'system';

export const DEFAULT_MQTT_BROKER: MqttBrokerSettings = {
  systemLogin: MQTT_SYSTEM_LOGIN,
  systemPassword: '',
};

export function parseMqttBrokerSettings(raw: unknown): MqttBrokerSettings {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_MQTT_BROKER };
  const v = raw as Record<string, unknown>;
  return {
    systemLogin: MQTT_SYSTEM_LOGIN,
    systemPassword: String(v.systemPassword ?? ''),
  };
}
