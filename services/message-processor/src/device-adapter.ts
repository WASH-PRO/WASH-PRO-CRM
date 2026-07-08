import type { WashMessage } from './processor.js';

/**
 * WASH-PRO native MQTT adapter.
 * Topic serial segment → postSerial / serialNumber in CRM (1:1, no transforms).
 * Monetary fields (totals, balance, credit) are rubles — passed through unchanged.
 */

/** Parsed WASH-PRO device topic: {dt_pref}/{serial}/state/{suffix} */
export interface DeviceTopic {
  dtPref: string;
  serial: string;
  suffix: string;
}

const DEVICE_TOPIC_RE = /^([^/]+)\/([^/]+)\/(.+)$/;
const LEGACY_TOPIC_RE = /^wash\/telemetry\/([^/]+)$/;

/** CRM message types derived from native MQTT topic path. */
const MQTT_SUFFIX_MESSAGE_TYPE: Record<string, string> = {
  process: 'process',
  totals: 'totals',
  usages: 'usages',
  credit: 'credit',
  card: 'card',
};

/**
 * Build a telemetry row from a raw MQTT message (one row per broker publish).
 */
export function inferMqttLogEntry(
  topic: string,
  raw: unknown
): { postSerial: string; messageType: string; payload: Record<string, unknown> } {
  const payload =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : { _value: raw };

  const deviceMatch = DEVICE_TOPIC_RE.exec(topic);
  if (deviceMatch) {
    const serial = deviceMatch[2];
    const path = deviceMatch[3];
    const [section, suffix] = path.includes('/') ? path.split('/', 2) : ['', path];

    let messageType = suffix || path;
    if (section === 'set') {
      messageType =
        suffix === 'prices' ? 'prices' : suffix === 'command' ? 'command' : suffix === 'ack' ? 'ack' : 'settings';
    } else if (section === 'state') {
      messageType = MQTT_SUFFIX_MESSAGE_TYPE[suffix] || suffix;
    }

    return { postSerial: serial, messageType, payload };
  }

  const legacyMatch = LEGACY_TOPIC_RE.exec(topic);
  if (legacyMatch) {
    if (isLegacyEnvelope(raw)) {
      const envelope = raw as WashMessage;
      return {
        postSerial: envelope.postSerial || String(envelope.payload?.postSerial || ''),
        messageType: envelope.messageType || legacyMatch[1],
        payload: envelope.payload || payload,
      };
    }
    return {
      postSerial: String(payload.postSerial || ''),
      messageType: legacyMatch[1],
      payload,
    };
  }

  if (isLegacyEnvelope(raw)) {
    const envelope = raw as WashMessage;
    return {
      postSerial: envelope.postSerial || String(envelope.payload?.postSerial || ''),
      messageType: envelope.messageType,
      payload: envelope.payload || payload,
    };
  }

  return { postSerial: String(payload.postSerial || ''), messageType: 'unknown', payload };
}

export function parseDeviceTopic(topic: string): DeviceTopic | null {
  const match = /^([^/]+)\/([^/]+)\/state\/([^/]+)$/.exec(topic);
  if (!match) return null;
  return { dtPref: match[1], serial: match[2], suffix: match[3] };
}

export function isLegacyEnvelope(value: unknown): value is WashMessage {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return typeof obj.messageType === 'string' && (
    typeof obj.postSerial === 'string' ||
    (typeof obj.payload === 'object' && obj.payload !== null && 'postSerial' in (obj.payload as object))
  );
}

function nowIso(): string {
  return new Date().toISOString();
}

function baseMessage(serial: string, messageType: string, payload: Record<string, unknown>): WashMessage {
  return {
    postSerial: serial,
    messageType,
    payload,
    timestamp: nowIso(),
  };
}

function mapProcessPayload(data: Record<string, unknown>): Record<string, unknown> {
  const number = Number(data.number ?? data.current_program ?? -1);
  const equipmentState: Record<string, unknown> = { source: 'washpro' };

  if (data.card != null) equipmentState.card = data.card;
  if (data.type != null) equipmentState.cardType = data.type;
  if (data.inactiv != null) equipmentState.inactivTimer = data.inactiv;
  if (data.light != null) equipmentState.lightTimer = data.light;

  return {
    balance: Number(data.balance ?? 0),
    discount: Number(data.discount ?? 0),
    freePause: Number(data.pause ?? data.free_pause ?? 0),
    modeNumber: number >= 0 ? number : 0,
    mode: number >= 0 ? `program_${number}` : 'idle',
    equipmentState,
  };
}

function mapFinanceTotals(data: Record<string, unknown>, serial: string): WashMessage[] {
  const acash = Number(data.acash ?? 0);
  const anoncash = Number(data.anoncash ?? 0);
  const adiscount = Number(data.adiscount ?? 0);
  const tcash = Number(data.tcash ?? 0);
  const tnoncash = Number(data.tnoncash ?? 0);
  const tdiscount = Number(data.tdiscount ?? 0);
  const ts = nowIso();

  return [
    {
      postSerial: serial,
      messageType: 'finance',
      payload: {
        period: 'before_collection',
        cash: acash,
        cashless: anoncash,
        discountOps: adiscount,
        totalRevenue: acash + anoncash,
        source: 'washpro',
      },
      timestamp: ts,
    },
    {
      postSerial: serial,
      messageType: 'finance',
      payload: {
        period: 'after_collection',
        cash: tcash,
        cashless: tnoncash,
        discountOps: tdiscount,
        totalRevenue: tcash + tnoncash,
        source: 'washpro',
      },
      timestamp: ts,
    },
  ];
}

function mapUsages(data: Record<string, unknown>, serial: string): WashMessage[] {
  const ts = nowIso();

  const rows: Array<{
    key: keyof typeof data | string;
    period: 'before_collection' | 'after_collection';
    category: 'regular' | 'service' | 'unlimited' | 'collection';
    discountType?: string;
  }> = [
    { key: 'aclients', period: 'before_collection', category: 'regular' },
    { key: 'aservices', period: 'before_collection', category: 'service' },
    { key: 'aunlims', period: 'before_collection', category: 'unlimited' },
    { key: 'acollections', period: 'before_collection', category: 'collection' },
    { key: 'acollection', period: 'before_collection', category: 'collection' },
    { key: 'tclients', period: 'after_collection', category: 'regular' },
    { key: 'tservices', period: 'after_collection', category: 'service' },
    { key: 'tunlims', period: 'after_collection', category: 'unlimited' },
    { key: 'tcollections', period: 'after_collection', category: 'collection' },
    { key: 'tcollection', period: 'after_collection', category: 'collection' },
  ];

  for (let i = 1; i <= 5; i += 1) {
    rows.push(
      { key: `aclient${i}`, period: 'before_collection', category: 'regular', discountType: String(i) },
      { key: `adt${i}`, period: 'before_collection', category: 'regular', discountType: String(i) },
      { key: `tclient${i}`, period: 'after_collection', category: 'regular', discountType: String(i) },
      { key: `tdt${i}`, period: 'after_collection', category: 'regular', discountType: String(i) }
    );
  }

  return rows.flatMap(({ key, period, category, discountType }) => {
    const raw = data[key];
    if (raw == null || raw === '') return [];
    const minutes = Number(raw);
    if (!Number.isFinite(minutes) || minutes < 0) return [];
    return [
      {
        postSerial: serial,
        messageType: 'statistics',
        payload: {
          period,
          category,
          ...(discountType ? { discountType } : {}),
          usageTime: minutes * 60,
          clientCount: minutes,
          launchCount: 0,
          source: 'washpro',
        },
        timestamp: ts,
      },
    ];
  });
}

const CREDIT_TYPE_LABELS = ['наличные', 'безнал', 'скидка'] as const;

function mapCredit(data: Record<string, unknown>, serial: string): WashMessage {
  const type = Number(data.type ?? 0);
  const amount = Number(data.summ ?? data.sum ?? 0);
  const label = CREDIT_TYPE_LABELS[type] ?? `тип ${type}`;

  return baseMessage(serial, 'event', {
    eventType: 'credit',
    creditType: type,
    amount,
    message: `Зачисление ${amount} (${label})`,
    source: 'washpro',
  });
}

const CARD_TYPE_MAP: Record<number, string> = {
  0: 'regular',
  1: 'service',
  2: 'unlimited',
  3: 'collection',
};

function mapCard(data: Record<string, unknown>, serial: string): WashMessage {
  const type = Number(data.type ?? 0);
  const cardNumber = String(data.card ?? data.card_number ?? '');
  const discountType = data.number != null ? String(data.number) : undefined;

  return baseMessage(serial, 'card', {
    cardNumber,
    cardType: CARD_TYPE_MAP[type] ?? 'regular',
    discountType,
    status: 'success',
    source: 'washpro',
  });
}

/**
 * Convert WASH-PRO device MQTT message (flat JSON + topic) to CRM envelope(s).
 * Returns null if topic/payload cannot be mapped.
 */
export function convertDeviceMessage(
  topic: string,
  data: Record<string, unknown>
): WashMessage | WashMessage[] | null {
  const parsed = parseDeviceTopic(topic);
  if (!parsed) return null;

  const { serial, suffix } = parsed;

  switch (suffix) {
    case 'process':
      return baseMessage(serial, 'state', mapProcessPayload(data));
    case 'totals':
      return mapFinanceTotals(data, serial);
    case 'usages':
      return mapUsages(data, serial);
    case 'credit':
      return mapCredit(data, serial);
    case 'card':
      return mapCard(data, serial);
    default:
      return null;
  }
}
