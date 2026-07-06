export type DeviceCommandKey =
  | 'soft_reset'
  | 'hard_reset'
  | 'credit_balance'
  | 'fault_mode'
  | 'service_mode'
  | 'vip_mode'
  | 'collection_mode';

export const DEVICE_COMMAND_OPTIONS: { value: DeviceCommandKey; label: string; group?: string }[] = [
  { value: 'soft_reset', label: 'Мягкая перезагрузка', group: 'Система' },
  { value: 'hard_reset', label: 'Жёсткая перезагрузка', group: 'Система' },
  { value: 'credit_balance', label: 'Зачисление баланса', group: 'Операции' },
  { value: 'fault_mode', label: 'Режим неисправности', group: 'Режимы' },
  { value: 'service_mode', label: 'Обслуживание бокса', group: 'Режимы' },
  { value: 'vip_mode', label: 'VIP-режим', group: 'Режимы' },
  { value: 'collection_mode', label: 'Режим инкассации', group: 'Режимы' },
];

const SKIP_PRICE_KEYS = new Set(['direction', 'cmd', 'command', 'summ', 'type', 'prices']);

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

/** Парсит цены из CRM JSON или с устройства (ключи 0–9, price0, price_1, …). */
export function parseModePrices(raw: unknown): Record<string, number> {
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

  const source =
    (raw as Record<string, unknown>).prices &&
    typeof (raw as Record<string, unknown>).prices === 'object' &&
    !Array.isArray((raw as Record<string, unknown>).prices)
      ? (raw as Record<string, unknown>).prices
      : raw;

  const result: Record<string, number> = {};
  for (const [key, value] of Object.entries(source as Record<string, unknown>)) {
    if (SKIP_PRICE_KEYS.has(key)) continue;

    const modeMatch = /^price[_-]?([0-9])$/i.exec(key) || /^p([0-9])$/i.exec(key);
    const modeKey = modeMatch ? modeMatch[1]! : /^\d+$/.test(key) ? key : null;
    if (!modeKey) continue;

    const n = Number(value);
    if (Number.isFinite(n) && n >= 0) result[String(modeKey)] = n;
  }
  return result;
}

export function hasModePrices(prices: Record<string, number>): boolean {
  return Object.keys(prices).length > 0;
}

export function commandNeedsAmount(command: DeviceCommandKey): boolean {
  return command === 'credit_balance';
}
