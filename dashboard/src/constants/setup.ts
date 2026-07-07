export const DEMO_WASH_NAME = 'Автомойка «Центральная»';
export const DEMO_WASH_ADDRESS = 'г. Москва, ул. Примерная, 1';
export const DEMO_POST_SERIALS = ['WP-POST-001', 'WP-POST-002'] as const;

export function isDemoWash(wash: { name: string; address?: string }): boolean {
  return wash.name === DEMO_WASH_NAME || wash.address === DEMO_WASH_ADDRESS;
}

export function isDemoPostSerial(serialNumber?: string): boolean {
  const serial = serialNumber?.trim() ?? '';
  return (DEMO_POST_SERIALS as readonly string[]).includes(serial);
}

export const SETUP_STEPS = [
  { id: 'welcome', label: 'Старт' },
  { id: 'infra', label: 'Инфраструктура' },
  { id: 'wash', label: 'Объект' },
  { id: 'posts', label: 'Посты' },
  { id: 'currency', label: 'Валюта' },
  { id: 'mqtt', label: 'MQTT' },
  { id: 'refs', label: 'Справочники' },
  { id: 'done', label: 'Готово' },
] as const;

export type SetupStepId = (typeof SETUP_STEPS)[number]['id'];
