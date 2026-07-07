import mqtt, { type MqttClient } from 'mqtt';
import { logger } from './api-client.js';

const MQTT_URL = process.env.MQTT_URL || 'mqtt://superadmin@mosquitto:1883';
const MQTT_TOPIC = process.env.MQTT_TOPIC || 'wash/telemetry/#';
const MQTT_DEVICE_TOPIC = process.env.MQTT_DEVICE_TOPIC || '+/+/#';
export const DLQ_TOPIC = process.env.MQTT_DLQ_TOPIC || 'wash/dlq';

function parseSubscribeTopics(): string[] {
  const extra = process.env.MQTT_TOPICS?.split(',').map((t) => t.trim()).filter(Boolean);
  if (extra?.length) return [...new Set([...extra, DLQ_TOPIC])];
  return [...new Set([MQTT_TOPIC, MQTT_DEVICE_TOPIC, DLQ_TOPIC].filter(Boolean))];
}

export const SUBSCRIBE_TOPICS = parseSubscribeTopics();

let client: MqttClient | null = null;

export function getMqttClient(): MqttClient {
  if (!client) {
    throw new Error('MQTT client not connected');
  }
  return client;
}

export function connectMqtt(onMessage: (topic: string, payload: Buffer) => void): MqttClient {
  client = mqtt.connect(MQTT_URL, {
    reconnectPeriod: 5000,
    connectTimeout: 30000,
    clean: true,
  });

  client.on('connect', () => {
    logger.info({ topics: SUBSCRIBE_TOPICS }, 'Connected to MQTT broker');
    client!.subscribe(SUBSCRIBE_TOPICS, { qos: 1 }, (err) => {
      if (err) logger.error({ err, topics: SUBSCRIBE_TOPICS }, 'Failed to subscribe');
    });
  });

  client.on('message', (topic, payload) => {
    onMessage(topic, payload);
  });

  client.on('error', (err) => {
    logger.error({ err }, 'MQTT connection error');
  });

  client.on('reconnect', () => {
    logger.info('Reconnecting to MQTT broker...');
  });

  client.on('offline', () => {
    logger.warn('MQTT client offline');
  });

  process.on('SIGTERM', () => {
    logger.info('Shutting down...');
    client?.end(true, () => process.exit(0));
  });

  return client;
}

export function publishMqtt(topic: string, payload: unknown): Promise<void> {
  const mqttClient = getMqttClient();
  const body = JSON.stringify(payload);
  return new Promise((resolve, reject) => {
    mqttClient.publish(topic, body, { qos: 1 }, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}
