import type { PostSettings } from '../types';

export function defaultMqttLogin(serialNumber: string): string {
  const serial = serialNumber.trim();
  return serial || 'post';
}

export function generateMqttPassword(length = 16): string {
  const bytes = crypto.getRandomValues(new Uint8Array(Math.ceil(length / 2)));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('').slice(0, length);
}

export function readPostMqttSettings(settings?: PostSettings): { mqttLogin: string; mqttPassword: string } {
  return {
    mqttLogin: settings?.mqttLogin?.trim() ?? '',
    mqttPassword: settings?.mqttPassword ?? '',
  };
}

/** Нужна ли синхронизация Mosquitto после сохранения поста. */
export function needsMqttUserSync(
  existing: { serialNumber: string; settings?: PostSettings } | undefined,
  next: { serialNumber: string; mqttLogin: string; mqttPassword: string }
): boolean {
  if (!existing) return true;
  const prev = readPostMqttSettings(existing.settings);
  const nextLogin = next.mqttLogin.trim() || defaultMqttLogin(next.serialNumber);
  const prevLogin = prev.mqttLogin || defaultMqttLogin(existing.serialNumber);
  return (
    existing.serialNumber.trim() !== next.serialNumber.trim() ||
    prevLogin !== nextLogin ||
    prev.mqttPassword !== next.mqttPassword
  );
}

/** Адрес брокера для подсказки оператору (панель подключается к IP сервера CRM). */
export function mqttBrokerEndpoint(hostname?: string): string {
  const host = hostname?.trim() || (typeof window !== 'undefined' ? window.location.hostname : 'localhost');
  const port = import.meta.env.VITE_MQTT_EXTERNAL_PORT || '1883';
  return `${host}:${port}`;
}
