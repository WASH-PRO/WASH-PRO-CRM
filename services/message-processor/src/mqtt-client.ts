import mqtt, { type MqttClient } from 'mqtt';
import { logger } from './api-client.js';
import { loadMqttBrokerCredentials } from './mqtt-broker-settings.js';

const MQTT_BROKER_HOST = process.env.MQTT_BROKER_HOST || 'mosquitto';
const MQTT_BROKER_PORT = process.env.MQTT_BROKER_PORT || '1883';
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
let messageHandler: ((topic: string, payload: Buffer) => void) | null = null;
let activeUser = '';
let activePassword = '';
let connecting: Promise<void> | null = null;

export function getMqttClient(): MqttClient {
  if (!client) {
    throw new Error('MQTT client not connected');
  }
  return client;
}

export function isMqttConnected(): boolean {
  return client?.connected ?? false;
}

function buildMqttUrl(user: string, password: string): string {
  return `mqtt://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${MQTT_BROKER_HOST}:${MQTT_BROKER_PORT}`;
}

async function openConnection(user: string, password: string): Promise<void> {
  if (client) {
    client.removeAllListeners();
    client.end(true);
    client = null;
  }

  const url = buildMqttUrl(user, password);
  activeUser = user;
  activePassword = password;

  await new Promise<void>((resolve, reject) => {
    const next = mqtt.connect(url, {
      reconnectPeriod: 5000,
      connectTimeout: 30000,
      clean: true,
    });
    client = next;

    next.on('connect', () => {
      logger.info({ topics: SUBSCRIBE_TOPICS, user }, 'Connected to MQTT broker');
      next.subscribe(SUBSCRIBE_TOPICS, { qos: 1 }, (err) => {
        if (err) {
          logger.error({ err, topics: SUBSCRIBE_TOPICS }, 'Failed to subscribe');
          reject(err);
          return;
        }
        resolve();
      });
    });

    next.on('message', (topic, payload) => {
      messageHandler?.(topic, payload);
    });

    next.on('error', (err) => {
      logger.error({ err }, 'MQTT connection error');
      if (!next.connected) reject(err);
    });

    next.on('reconnect', () => {
      logger.info('Reconnecting to MQTT broker...');
    });

    next.on('offline', () => {
      logger.warn('MQTT client offline');
    });
  });
}

async function ensureConnected(): Promise<void> {
  if (connecting) {
    await connecting;
    return;
  }

  connecting = (async () => {
    const { user, password } = await loadMqttBrokerCredentials();
    if (client?.connected && user === activeUser && password === activePassword) {
      return;
    }
    await openConnection(user, password);
  })();

  try {
    await connecting;
  } finally {
    connecting = null;
  }
}

export function connectMqtt(onMessage: (topic: string, payload: Buffer) => void): void {
  messageHandler = onMessage;
  void ensureConnected().catch((err) => {
    logger.error({ err }, 'Initial MQTT connection failed');
  });

  process.on('SIGTERM', () => {
    logger.info('Shutting down...');
    client?.end(true, () => process.exit(0));
  });
}

export async function reconnectMqttBroker(): Promise<void> {
  await ensureConnected();
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
