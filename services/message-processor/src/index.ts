import { convertDeviceMessage, inferMqttLogEntry, isLegacyEnvelope } from './device-adapter.js';
import { processMessage, WashMessage } from './processor.js';
import { apiRequest, logger } from './api-client.js';
import { connectMqtt, DLQ_TOPIC, getMqttClient } from './mqtt-client.js';
import { startProcessorHttpServer } from './http.js';
import { syncMqttUsersFromPosts } from './mqtt-users.js';
import { syncPricesFromDevice } from './post-settings.js';
import { extractNativeTopicSerial, getBindingBySerial, resolveTrustedPostSerial, bindingsBySerialSize } from './mqtt-post-bindings.js';

function normalizeIncoming(topic: string, raw: unknown): WashMessage[] {
  if (isLegacyEnvelope(raw)) {
    return [raw];
  }

  if (raw && typeof raw === 'object') {
    const converted = convertDeviceMessage(topic, raw as Record<string, unknown>);
    if (converted) {
      return Array.isArray(converted) ? converted : [converted];
    }
  }

  return [];
}

async function logRawMqtt(topic: string, raw: unknown): Promise<void> {
  try {
    const entry = inferMqttLogEntry(topic, raw);
    await apiRequest('POST', '/api/crm/telemetry', {
      mqttTopic: topic,
      postSerial: entry.postSerial,
      messageType: entry.messageType,
      payload: entry.payload,
      receivedAt: new Date().toISOString(),
    });
  } catch (err) {
    logger.warn({ err, topic }, 'Raw MQTT telemetry log failed (non-fatal)');
  }
}

async function logDlqMessage(sourceTopic: string, raw: unknown, error?: unknown): Promise<void> {
  try {
    const entry = inferMqttLogEntry(sourceTopic, raw);
    await apiRequest('POST', '/api/crm/telemetry', {
      mqttTopic: DLQ_TOPIC,
      postSerial: entry.postSerial,
      messageType: 'dlq',
      payload: {
        sourceTopic,
        error: error != null ? String(error) : undefined,
        body: raw,
      },
      receivedAt: new Date().toISOString(),
    });
  } catch (err) {
    logger.warn({ err, sourceTopic }, 'DLQ telemetry log failed (non-fatal)');
  }
}

async function handleMessage(topic: string, payload: Buffer): Promise<void> {
  if (topic === DLQ_TOPIC) {
    let raw: unknown;
    try {
      raw = JSON.parse(payload.toString()) as unknown;
    } catch {
      raw = { _raw: payload.toString(), _error: 'invalid_json' };
    }
    await logDlqMessage('wash/dlq', raw);
    return;
  }

  let raw: unknown;
  try {
    raw = JSON.parse(payload.toString()) as unknown;
  } catch {
    raw = { _raw: payload.toString(), _error: 'invalid_json' };
  }

  const entry = inferMqttLogEntry(topic, raw);
  const trustedSerial = resolveTrustedPostSerial(topic, isLegacyEnvelope(raw) ? raw : { payload: raw as Record<string, unknown> });

  if (trustedSerial) {
    const binding = getBindingBySerial(trustedSerial);
    const topicSerial = extractNativeTopicSerial(topic);
    if (topicSerial && bindingsBySerialSize() > 0 && !binding) {
      logger.warn({ topic, trustedSerial }, 'Unknown post serial in MQTT topic — ignored');
      return;
    }
  }

  await logRawMqtt(topic, raw);

  if (entry.messageType === 'prices' && trustedSerial && raw && typeof raw === 'object') {
    try {
      await syncPricesFromDevice(trustedSerial, raw as Record<string, unknown>);
    } catch (err) {
      logger.warn({ err, topic }, 'Device prices sync failed (non-fatal)');
    }
  }

  try {
    const messages = normalizeIncoming(topic, raw);

    if (messages.length === 0) {
      return;
    }

    for (const content of messages) {
      await processMessage(content, topic);
    }
  } catch (err) {
    logger.error({ err, topic }, 'Failed to process message');

    await logDlqMessage(topic, raw, err);

    try {
      const client = getMqttClient();
      if (client.connected) {
        client.publish(DLQ_TOPIC, payload, { qos: 1 });
      }
    } catch {
      // client not ready
    }

    if (String(err).includes('queue') || String(err).includes('overflow')) {
      try {
        const { createNotification } = await import('./api-client.js');
        await createNotification({
          type: 'queue_overflow',
          severity: 'error',
          message: 'Переполнение очереди сообщений',
        });
      } catch {
        // best effort
      }
    }
  }
}

function main(): void {
  logger.info('Message Processor starting...');
  connectMqtt((topic, payload) => {
    void handleMessage(topic, payload);
  });
  startProcessorHttpServer();
  setTimeout(() => {
    void syncMqttUsersFromPosts().catch((err) => {
      logger.warn({ err }, 'Startup MQTT user sync failed (non-fatal)');
    });
  }, 8000);
}

main();
