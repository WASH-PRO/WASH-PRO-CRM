/** Команды меню устройства → поле cmd в MQTT set/command */
export const DEVICE_COMMAND_CODES = {
  soft_reset: 1,
  hard_reset: 2,
  credit_balance: 3,
  fault_mode: 4,
  service_mode: 5,
  vip_mode: 6,
  collection_mode: 7,
} as const;

export type DeviceCommandKey = keyof typeof DEVICE_COMMAND_CODES;

const SERIAL_RE = /^[A-Za-z0-9._-]+$/;
const PREFIX_RE = /^[A-Za-z0-9._-]+$/;

export function sanitizeSerial(serial: string): string | null {
  const value = serial.trim();
  if (!value || !SERIAL_RE.test(value)) return null;
  return value;
}

export function resolveMqttPrefix(prefix?: string): string {
  const value = (prefix || process.env.MQTT_DEVICE_PREFIX || 'washpro').trim();
  if (!PREFIX_RE.test(value)) return 'washpro';
  return value;
}

export function buildSetTopic(prefix: string, serial: string, suffix: 'prices' | 'command'): string {
  return `${prefix}/${serial}/set/${suffix}`;
}

/** Режимы 8–9 (резина, дворники) — только с устройства, не отправляются из CRM. */
export const READONLY_MODE_CODES = new Set(['8', '9']);

export function isModePriceReadonly(code: string | number): boolean {
  return READONLY_MODE_CODES.has(String(code));
}

export function editableModePrices(prices: Record<string, number>): Record<string, number> {
  const result = { ...prices };
  for (const code of READONLY_MODE_CODES) delete result[code];
  return result;
}

/** Цены режимов: ключ — код режима (0–9), значение — рубли. */
const SKIP_PRICE_KEYS = new Set(['direction', 'cmd', 'command', 'summ', 'type', 'prices']);

export function normalizeModePrices(raw: unknown): Record<string, number> {
  if (raw == null) return {};

  if (Array.isArray(raw)) {
    const result: Record<string, number> = {};
    raw.forEach((value, index) => {
      const n = Number(value);
      if (Number.isFinite(n) && n >= 0) result[String(index)] = n;
    });
    return result;
  }

  if (typeof raw !== 'object') return {};

  const result: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (SKIP_PRICE_KEYS.has(key)) continue;

    const modeMatch = /^price[_-]?([0-9])$/i.exec(key) || /^p([0-9])$/i.exec(key);
    const modeKey = modeMatch ? modeMatch[1]! : /^\d+$/.test(key) ? key : null;
    if (!modeKey) continue;

    const n = Number(value);
    if (Number.isFinite(n) && n >= 0) result[String(modeKey)] = n;
  }
  return result;
}

export function pricesPayload(prices: Record<string, number>): Record<string, number> {
  return normalizeModePrices(prices);
}

export function commandPayload(command: DeviceCommandKey, amount?: number): Record<string, number> {
  const cmd = DEVICE_COMMAND_CODES[command];
  if (cmd == null) throw new Error(`Unknown command: ${command}`);
  const payload: Record<string, number> = { cmd };
  if (command === 'credit_balance') {
    const summ = Number(amount);
    if (!Number.isFinite(summ) || summ <= 0) {
      throw new Error('Для зачисления баланса укажите сумму больше 0');
    }
    payload.summ = summ;
  }
  return payload;
}

export function parseInboundPrices(payload: Record<string, unknown>): Record<string, number> {
  if (payload.prices && typeof payload.prices === 'object') {
    return normalizeModePrices(payload.prices);
  }
  return normalizeModePrices(payload);
}
