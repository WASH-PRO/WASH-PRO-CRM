import http from 'node:http';
import fetch from 'node-fetch';
import { pino } from 'pino';
import { apiRequest } from './api-client.js';
import { publishMqtt } from './mqtt-client.js';
import {
  buildSetTopic,
  commandPayload,
  DEVICE_COMMAND_CODES,
  type DeviceCommandKey,
  editableModePrices,
  pricesPayload,
  resolveMqttPrefix,
  sanitizeSerial,
} from './post-device.js';
import { mergePostSettings } from './post-settings.js';
import { syncMqttUsersFromPosts } from './mqtt-users.js';

const logger = pino({ level: 'info' });
const PORT = parseInt(process.env.PROCESSOR_HTTP_PORT || '3022', 10);
const API_URL = process.env.API_URL || 'http://dynamic-api:3001';

async function verifyToken(authHeader: string | undefined): Promise<boolean> {
  if (!authHeader?.startsWith('Bearer ')) return false;
  try {
    const res = await fetch(`${API_URL}/api/profile`, {
      headers: { Authorization: authHeader },
    });
    const json = (await res.json()) as { success?: boolean };
    return res.ok && json.success === true;
  } catch {
    return false;
  }
}

async function readBody(req: http.IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function logOutbound(topic: string, serial: string, messageType: string, payload: unknown): Promise<void> {
  try {
    await apiRequest('POST', '/api/crm/telemetry', {
      mqttTopic: topic,
      postSerial: serial,
      messageType,
      payload: payload as Record<string, unknown>,
      receivedAt: new Date().toISOString(),
    });
  } catch (err) {
    logger.warn({ err, topic }, 'Outbound MQTT log failed');
  }
}

export function startProcessorHttpServer(): void {
  const server = http.createServer(async (req, res) => {
    if (!(await verifyToken(req.headers.authorization))) {
      res.writeHead(401, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Unauthorized');
      return;
    }

    const url = req.url?.split('?')[0] ?? '';
    const pricesMatch = url.match(/^\/posts\/([^/]+)\/prices$/);
    const commandMatch = url.match(/^\/posts\/([^/]+)\/command$/);
    const syncUsersPath = url === '/mqtt/sync-users';

    if (req.method === 'POST' && syncUsersPath) {
      try {
        const result = await syncMqttUsersFromPosts();
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, data: result }));
      } catch (err) {
        const message = err instanceof Error ? err.message : 'MQTT user sync failed';
        logger.error({ err }, 'MQTT user sync failed');
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, error: message }));
      }
      return;
    }

    if (req.method === 'POST' && pricesMatch) {
      const serial = sanitizeSerial(decodeURIComponent(pricesMatch[1]!));
      if (!serial) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, error: 'Invalid serial' }));
        return;
      }

      try {
        const raw = await readBody(req);
        const body = JSON.parse(raw) as {
          prices?: Record<string, number>;
          mqttPrefix?: string;
          sendToDevice?: boolean;
          persist?: boolean;
        };
        const prices = pricesPayload(body.prices ?? {});
        const mqttPrefix = resolveMqttPrefix(body.mqttPrefix);
        const sendToDevice = body.sendToDevice !== false;
        const persist = body.persist !== false;
        const mqttPrices = editableModePrices(prices);

        if (persist) {
          await mergePostSettings(serial, {
            modePrices: prices,
            mqttPrefix,
            pricesUpdatedAt: new Date().toISOString(),
          });
        }

        let topic: string | undefined;
        if (sendToDevice) {
          topic = buildSetTopic(mqttPrefix, serial, 'prices');
          const payload = pricesPayload(mqttPrices);
          await publishMqtt(topic, payload);
          await logOutbound(topic, serial, 'prices', { ...payload, direction: 'outbound' });
        }

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, data: { topic, prices, mqttPrices, mqttPrefix } }));
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Prices publish failed';
        logger.error({ err, serial }, 'Prices request failed');
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, error: message }));
      }
      return;
    }

    if (req.method === 'POST' && commandMatch) {
      const serial = sanitizeSerial(decodeURIComponent(commandMatch[1]!));
      if (!serial) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, error: 'Invalid serial' }));
        return;
      }

      try {
        const raw = await readBody(req);
        const body = JSON.parse(raw) as {
          command?: DeviceCommandKey;
          amount?: number;
          mqttPrefix?: string;
        };
        if (!body.command || !(body.command in DEVICE_COMMAND_CODES)) {
          throw new Error('Не указана команда');
        }
        const mqttPrefix = resolveMqttPrefix(body.mqttPrefix);
        const payload = commandPayload(body.command, body.amount);
        const topic = buildSetTopic(mqttPrefix, serial, 'command');
        await publishMqtt(topic, payload);
        await logOutbound(topic, serial, 'command', { ...payload, direction: 'outbound', command: body.command });
        await mergePostSettings(serial, {
          lastCommand: body.command,
          lastCommandAt: new Date().toISOString(),
        });

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, data: { topic, payload, command: body.command } }));
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Command publish failed';
        logger.error({ err, serial }, 'Command request failed');
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, error: message }));
      }
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  });

  server.listen(PORT, () => {
    logger.info({ port: PORT }, 'Message processor HTTP server started');
  });
}
