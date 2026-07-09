import type { WashBotType } from './botTemplate.js';

export const MANAGEMENT_BOT_COMMANDS = [
  '/help',
  '/start',
  '/menu',
  '/status',
  '/washes',
  '/wash',
  '/wash_add',
  '/wash_edit',
  '/wash_del',
  '/posts',
  '/post',
  '/post_add',
  '/post_edit',
  '/post_del',
  '/post_cmd',
  '/revenue',
  '/statistics',
  '/cards',
] as const;

export const SERVICE_BOT_COMMANDS = [
  '/help',
  '/start',
  '/menu',
  '/status',
  '/washes',
  '/wash',
  '/posts',
  '/post',
  '/post_cmd',
  '/revenue',
  '/statistics',
  '/cards',
] as const;

export const INFORMATIONAL_BOT_COMMANDS = ['/help', '/start', '/menu'] as const;

export const BOT_COMMAND_PRESETS: Record<WashBotType, readonly string[]> = {
  management: MANAGEMENT_BOT_COMMANDS,
  service: SERVICE_BOT_COMMANDS,
  informational: INFORMATIONAL_BOT_COMMANDS,
};

/** Имена демо-ботов по умолчанию (как в Dashboard → Telegram). */
export const BOT_TYPE_NAMES: Record<WashBotType, string> = {
  management: 'Управление',
  service: 'Сервисный',
  informational: 'Информационный',
};

export const DEFAULT_DEMO_BOTS: Array<{
  botType: WashBotType;
  name: string;
  commands: string[];
}> = (['management', 'service', 'informational'] as const).map((botType) => ({
  botType,
  name: BOT_TYPE_NAMES[botType],
  commands: [...BOT_COMMAND_PRESETS[botType]],
}));
