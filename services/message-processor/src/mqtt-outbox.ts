import { randomUUID } from 'node:crypto';
import { apiRequest } from './api-client.js';
import { publishMqtt } from './mqtt-client.js';
import { loadMqttBrokerSettings, type MqttDeliverySettings } from './mqtt-broker-settings.js';
import { syncPricesFromDevice } from './post-settings.js';

export type OutboxKind = 'prices' | 'command';
export type OutboxStatus = 'pending' | 'delivered' | 'failed' | 'expired';

export interface MqttOutboxRow {
  id: string;
  messageId: string;
  postSerial: string;
  mqttTopic: string;
  kind: OutboxKind;
  payload: Record<string, unknown>;
  status: OutboxStatus;
  attempts: number;
  createdAt: string;
  expiresAt: string;
  ackAt?: string;
  lastError?: string;
  nextRedeliverAt?: string;
}

export interface DeliveryAckPayload {
  kind?: string;
  status?: string;
  message_id?: string;
  error_message?: string;
  cmd?: number;
}

export function newMessageId(): string {
  return randomUUID();
}

function retentionExpiresAt(settings: MqttDeliverySettings): string {
  const hours = Math.max(1, settings.outboundRetentionHours ?? 168);
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

export async function createOutboxEntry(input: {
  messageId: string;
  postSerial: string;
  mqttTopic: string;
  kind: OutboxKind;
  payload: Record<string, unknown>;
}): Promise<void> {
  const settings = await loadMqttBrokerSettings();
  const now = new Date().toISOString();
  await apiRequest('POST', '/api/crm/mqtt-outbox', {
    messageId: input.messageId,
    postSerial: input.postSerial,
    mqttTopic: input.mqttTopic,
    kind: input.kind,
    payload: input.payload,
    status: 'pending',
    attempts: 1,
    createdAt: now,
    expiresAt: retentionExpiresAt(settings),
    nextRedeliverAt: new Date(
      Date.now() + Math.max(5, settings.redeliverIntervalSec ?? 30) * 1000
    ).toISOString(),
  });
}

export async function handleDeliveryAck(
  postSerial: string,
  raw: DeliveryAckPayload
): Promise<void> {
  const messageId = raw.message_id?.trim();
  if (!messageId) return;

  const rows = await apiRequest<MqttOutboxRow[]>(
    'GET',
    `/api/crm/mqtt-outbox?limit=20&messageId=${encodeURIComponent(messageId)}`
  );
  const row = rows.find((r) => r.messageId === messageId && r.postSerial === postSerial);
  if (!row || row.status === 'delivered') return;

  const ok = String(raw.status ?? '').toLowerCase() === 'ok';
  const now = new Date().toISOString();

  await apiRequest('PATCH', `/api/crm/mqtt-outbox/${row.id}`, {
    status: ok ? 'delivered' : 'failed',
    ackAt: now,
    lastError: ok ? undefined : String(raw.error_message ?? 'device_error'),
  });

  if (ok && row.kind === 'prices') {
    try {
      await syncPricesFromDevice(postSerial, row.payload);
    } catch {
      // non-fatal
    }
  }
}

async function listOutbox(limit = 200): Promise<MqttOutboxRow[]> {
  return apiRequest<MqttOutboxRow[]>('GET', `/api/crm/mqtt-outbox?limit=${limit}`);
}

export async function runOutboxRedelivery(): Promise<void> {
  const settings = await loadMqttBrokerSettings();
  if (!settings.requireDeliveryConfirmation || !settings.redeliverOnNoAck) return;

  const maxAttempts = Math.max(1, settings.redeliverMaxAttempts ?? 5);
  const intervalMs = Math.max(5, settings.redeliverIntervalSec ?? 30) * 1000;
  const now = Date.now();
  const rows = await listOutbox(300);

  for (const row of rows) {
    if (row.status !== 'pending') continue;
    if (row.attempts >= maxAttempts) {
      await apiRequest('PATCH', `/api/crm/mqtt-outbox/${row.id}`, {
        status: 'failed',
        lastError: 'max_redelivery_attempts',
      });
      continue;
    }

    const expiresAt = new Date(row.expiresAt).getTime();
    if (Number.isFinite(expiresAt) && expiresAt <= now) {
      await apiRequest('PATCH', `/api/crm/mqtt-outbox/${row.id}`, { status: 'expired' });
      continue;
    }

    const nextAt = row.nextRedeliverAt ? new Date(row.nextRedeliverAt).getTime() : 0;
    if (nextAt > now) continue;

    const payload = {
      ...row.payload,
      message_id: row.messageId,
    };

    try {
      await publishMqtt(row.mqttTopic, payload);
      await apiRequest('PATCH', `/api/crm/mqtt-outbox/${row.id}`, {
        attempts: row.attempts + 1,
        nextRedeliverAt: new Date(now + intervalMs).toISOString(),
      });
    } catch (err) {
      await apiRequest('PATCH', `/api/crm/mqtt-outbox/${row.id}`, {
        attempts: row.attempts + 1,
        lastError: err instanceof Error ? err.message : 'redelivery_failed',
        nextRedeliverAt: new Date(now + intervalMs).toISOString(),
      });
    }
  }
}

export async function purgeExpiredOutbox(): Promise<number> {
  const settings = await loadMqttBrokerSettings();
  const cutoff = new Date(
    Date.now() - Math.max(1, settings.outboundRetentionHours ?? 168) * 60 * 60 * 1000
  ).toISOString();

  const rows = await listOutbox(500);
  let removed = 0;

  for (const row of rows) {
    const expired =
      row.status === 'expired' ||
      row.status === 'delivered' ||
      row.status === 'failed' ||
      (row.expiresAt && row.expiresAt < new Date().toISOString());

    const old = row.createdAt < cutoff;
    if (expired && old) {
      try {
        await apiRequest('DELETE', `/api/crm/mqtt-outbox/${row.id}`);
        removed++;
      } catch {
        // best effort
      }
    }
  }

  return removed;
}

export function startOutboxMaintenance(): void {
  const tick = () => {
    void runOutboxRedelivery().catch(() => undefined);
    void purgeExpiredOutbox().catch(() => undefined);
  };
  tick();
  setInterval(tick, 15_000);
}
