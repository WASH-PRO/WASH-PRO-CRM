import { logger } from './api-client.js';

export interface MqttPostBinding {
  postId: string;
  serialNumber: string;
  mqttLogin: string;
}

let bindingsByLogin = new Map<string, MqttPostBinding>();
let bindingsBySerial = new Map<string, MqttPostBinding>();

export function setMqttPostBindings(bindings: MqttPostBinding[]): void {
  bindingsByLogin = new Map();
  bindingsBySerial = new Map();
  for (const binding of bindings) {
    bindingsByLogin.set(binding.mqttLogin, binding);
    bindingsBySerial.set(binding.serialNumber, binding);
  }
}

export function getBindingBySerial(serial: string): MqttPostBinding | undefined {
  return bindingsBySerial.get(serial);
}

export function bindingsBySerialSize(): number {
  return bindingsBySerial.size;
}

/** Серийный номер из нативного топика {prefix}/{serial}/…; legacy wash/telemetry не разбираем. */
export function extractNativeTopicSerial(topic: string): string | null {
  if (topic.startsWith('wash/telemetry')) return null;
  const match = /^[^/]+\/([^/]+)\//.exec(topic);
  return match?.[1]?.trim() || null;
}

/**
 * Доверенный serial для CRM: из топика (приоритет), legacy — только postSerial в теле.
 * Несовпадение serial в топике и payload игнорируется с предупреждением.
 */
export function resolveTrustedPostSerial(
  topic: string,
  msg?: { postSerial?: string; payload?: Record<string, unknown> }
): string | null {
  const topicSerial = extractNativeTopicSerial(topic);
  const payloadSerial = (msg?.postSerial || String(msg?.payload?.postSerial || '')).trim();

  if (topicSerial) {
    if (payloadSerial && payloadSerial !== topicSerial) {
      logger.warn(
        { topic, topicSerial, payloadSerial },
        'MQTT payload postSerial does not match topic — using topic serial'
      );
    }
    return topicSerial;
  }

  if (topic.startsWith('wash/telemetry')) {
    return payloadSerial || null;
  }

  return payloadSerial || null;
}
