import fetch from 'node-fetch';
import { pino } from 'pino';

const logger = pino({ level: 'info' });

const API_URL = process.env.API_URL || 'http://dynamic-api:3001';
const SERVICE_LOGIN = process.env.SERVICE_LOGIN || 'service';
const SERVICE_PASSWORD = process.env.SERVICE_PASSWORD || 'ServiceInternal123!';
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL_MS || '5000', 10);

interface TelegramConfig {
  token: string;
  adminIds: number[];
  allowedCommands: string[];
  enabled: boolean;
}

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from?: { id: number };
    chat: { id: number };
    text?: string;
  };
}

let offset = 0;
let cachedToken: string | null = null;

async function getApiToken(): Promise<string> {
  if (cachedToken) return cachedToken;
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: SERVICE_LOGIN, password: SERVICE_PASSWORD }),
  });
  const json = (await res.json()) as { success: boolean; data?: { accessToken: string } };
  if (!json.success || !json.data?.accessToken) throw new Error('Service login failed');
  cachedToken = json.data.accessToken;
  return cachedToken;
}

async function apiGet<T>(path: string): Promise<T> {
  const token = await getApiToken();
  const res = await fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = (await res.json()) as { success: boolean; data?: T };
  return json.data as T;
}

async function loadConfig(): Promise<TelegramConfig> {
  const settings = await apiGet<Array<{ key: string; value: TelegramConfig }>>('/api/crm/settings');
  const tg = settings.find((s) => s.key === 'telegram');
  const envToken = process.env.TELEGRAM_BOT_TOKEN || '';
  const envAdmins = (process.env.TELEGRAM_ADMIN_IDS || '')
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n));

  return {
    token: tg?.value?.token || envToken,
    adminIds: tg?.value?.adminIds?.length ? tg.value.adminIds : envAdmins,
    allowedCommands: tg?.value?.allowedCommands || ['/status', '/washes', '/posts', '/revenue', '/statistics', '/cards'],
    enabled: tg?.value?.enabled ?? Boolean(envToken),
  };
}

async function sendMessage(botToken: string, chatId: number, text: string): Promise<void> {
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  });
}

async function handleCommand(command: string, config: TelegramConfig): Promise<string> {
  switch (command) {
    case '/status': {
      const states = await apiGet<Array<{ connected?: boolean; postId: string }>>('/api/crm/post-states?limit=100');
      const online = states.filter((s) => s.connected).length;
      return `<b>Статус системы</b>\nПостов онлайн: ${online}/${states.length}`;
    }
    case '/washes': {
      const washes = await apiGet<Array<{ name: string; address: string }>>('/api/crm/washes?limit=50');
      if (!washes.length) return 'Автомоек нет';
      return `<b>Автомойки</b>\n` + washes.map((w) => `• ${w.name} — ${w.address}`).join('\n');
    }
    case '/posts': {
      const posts = await apiGet<Array<{ name: string; postNumber: number; status: string }>>('/api/crm/posts?limit=100');
      if (!posts.length) return 'Постов нет';
      return `<b>Посты</b>\n` + posts.map((p) => `• #${p.postNumber} ${p.name} [${p.status}]`).join('\n');
    }
    case '/revenue': {
      const stats = await apiGet<Array<{ totalRevenue: number; period: string }>>('/api/crm/finance-stats?limit=50');
      const total = stats.reduce((sum, s) => sum + (s.totalRevenue || 0), 0);
      return `<b>Выручка</b>\nОбщая: ${total.toFixed(2)} ₽\nЗаписей: ${stats.length}`;
    }
    case '/statistics': {
      const stats = await apiGet<Array<{ launchCount: number; usageTime: number }>>('/api/crm/usage-stats?limit=50');
      const launches = stats.reduce((s, x) => s + (x.launchCount || 0), 0);
      const time = stats.reduce((s, x) => s + (x.usageTime || 0), 0);
      return `<b>Статистика</b>\nЗапусков: ${launches}\nВремя: ${Math.round(time / 60)} мин`;
    }
    case '/cards': {
      const cards = await apiGet<Array<{ cardNumber: string; balance: number; status: string }>>('/api/crm/cards?limit=20');
      if (!cards.length) return 'Карт нет';
      return `<b>Карты</b>\n` + cards.map((c) => `• ${c.cardNumber}: ${c.balance}₽ [${c.status}]`).join('\n');
    }
    default:
      return 'Неизвестная команда. Доступные: /status /washes /posts /revenue /statistics /cards';
  }
}

async function poll(config: TelegramConfig): Promise<void> {
  if (!config.enabled || !config.token) return;

  const res = await fetch(
    `https://api.telegram.org/bot${config.token}/getUpdates?offset=${offset}&timeout=10`
  );
  const json = (await res.json()) as { ok: boolean; result: TelegramUpdate[] };
  if (!json.ok) return;

  for (const update of json.result) {
    offset = update.update_id + 1;
    const msg = update.message;
    if (!msg?.text || !msg.from) continue;

    const userId = msg.from.id;
    if (!config.adminIds.includes(userId)) {
      await sendMessage(config.token, msg.chat.id, 'Доступ запрещён');
      continue;
    }

    const cmd = msg.text.split(' ')[0].toLowerCase();
    if (!config.allowedCommands.map((c) => c.toLowerCase()).includes(cmd)) {
      await sendMessage(config.token, msg.chat.id, 'Команда не разрешена');
      continue;
    }

    try {
      const reply = await handleCommand(cmd, config);
      await sendMessage(config.token, msg.chat.id, reply);
    } catch (err) {
      logger.error({ err, cmd }, 'Command failed');
      await sendMessage(config.token, msg.chat.id, 'Ошибка выполнения команды');
    }
  }
}

async function main(): Promise<void> {
  logger.info('Telegram bot service starting');

  setInterval(async () => {
    try {
      const config = await loadConfig();
      await poll(config);
    } catch (err) {
      logger.error({ err }, 'Poll cycle failed');
    }
  }, POLL_INTERVAL);
}

main();
