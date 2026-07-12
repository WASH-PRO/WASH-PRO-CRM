#!/usr/bin/env node
/**
 * Удаляет все публикации CRM и создаёт 10 демо-записей (HTML + картинки + эмодзи).
 * Картинки для Telegram/CRM; VK публикатор передаёт только текст.
 *
 * Usage:
 *   node scripts/reset-info-messages-vk-demo.mjs
 */

const API_URL = process.env.API_URL || 'http://localhost:3001';
const ADMIN_LOGIN = process.env.ADMIN_LOGIN || process.env.SERVICE_LOGIN || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || process.env.SERVICE_PASSWORD || 'Admin123!';

const IMAGES = [
  'https://placehold.co/800x450/0077ff/ffffff/png?text=Wash+Pro+1',
  'https://placehold.co/800x450/0066cc/ffffff/png?text=Wash+Pro+2',
  'https://placehold.co/800x450/0055aa/ffffff/png?text=Wash+Pro+3',
  'https://placehold.co/800x450/004488/ffffff/png?text=Wash+Pro+4',
  'https://placehold.co/800x450/003366/ffffff/png?text=Wash+Pro+5',
];

const PUBLICATIONS = [
  {
    title: '🚗 Утренняя мойка со скидкой 15%',
    category: 'promotion',
    body: `<p><strong>Только до 12:00</strong> — скидка <em>15%</em> на все программы самообслуживания.</p>
<ul>
<li>🫧 Пена + ополаскивка</li>
<li>💳 Оплата картой или наличными</li>
<li>📍 Все посты участвуют</li>
</ul>
<p><i>Акция 1 из 10.</i></p>`,
  },
  {
    title: '💧 Новый режим «Эко-мойка»',
    category: 'news',
    body: `<p>Запустили щадящий режим с <strong>сниженным расходом воды</strong> — результат тот же, расход меньше.</p>
<p>🔋 Подходит для ежедневного ухода<br/>🌿 Бережнее к лакокрасочному покрытию</p>
<p><i>Новость 2 из 10.</i></p>`,
  },
  {
    title: '🎁 Третья мойка в месяц — бесплатная сушка',
    category: 'promotion',
    body: `<p>Акция для постоянных клиентов:</p>
<ol>
<li>🧾 Совершите 3 мойки в календарном месяце</li>
<li>📱 Покажите историю в боте</li>
<li>🌬️ Получите бесплатную сушку</li>
</ol>
<p><i>Акция 3 из 10.</i></p>`,
  },
  {
    title: '🛠 Обновление терминалов оплаты',
    category: 'news',
    body: `<p>На всех постах установлены <strong>новые терминалы</strong> с поддержкой бесконтактной оплаты.</p>
<p>✅ Быстрее авторизация<br/>✅ Apple Pay / Google Pay<br/>✅ Чеки на e-mail</p>
<p><i>Новость 4 из 10.</i></p>`,
  },
  {
    title: '⭐ Отзыв в Telegram — подарок',
    category: 'promotion',
    body: `<p>Оставьте отзыв через информационного бота и получите <strong>ароматизатор</strong> на выбор.</p>
<p>🎀 Лимит: 1 подарок на автомобиль в неделю<br/>📅 До конца месяца</p>
<p><i>Акция 5 из 10.</i></p>`,
  },
  {
    title: '🌙 Ночная мойка: тише и без очереди',
    category: 'news',
    body: `<p>С <strong>22:00 до 06:00</strong> на площадке меньше поток — удобно для фургонов и такси.</p>
<p>🚦 Световая разметка обновлена<br/>🔦 Дополнительная подсветка зеркал</p>
<p><i>Новость 6 из 10.</i></p>`,
  },
  {
    title: '🏷 Семейный абонемент −20%',
    category: 'promotion',
    body: `<p>Оформите абонемент на <em>2 и более</em> автомобиля в одной семье:</p>
<ul>
<li>👨‍👩‍👧 Скидка 20% на пакет моек</li>
<li>📆 Срок действия 90 дней</li>
<li>🔄 Перенос между постами</li>
</ul>
<p><i>Акция 7 из 10.</i></p>`,
  },
  {
    title: '🧽 Чистка пылесосной зоны',
    category: 'news',
    body: `<p>Плановое обслуживание <strong>пылесосных постов</strong> завершено — мощность восстановлена на 100%.</p>
<p>🕐 Работают круглосуточно<br/>🧴 Одноразовые перчатки у каждого аппарата</p>
<p><i>Новость 8 из 10.</i></p>`,
  },
  {
    title: '🎂 Скидка в день рождения',
    category: 'promotion',
    body: `<p><strong>−25%</strong> на любую программу в день рождения и ±3 дня.</p>
<p>🪪 Предъявите документ администратору или напишите в бот<br/>🎉 Действует один раз в год</p>
<p><i>Акция 9 из 10.</i></p>`,
  },
  {
    title: '📢 Правила площадки — напоминание',
    category: 'general',
    body: `<p>Просим соблюдать простые правила для комфорта всех:</p>
<ul>
<li>⏱ Не более 20 минут на посту при очереди</li>
<li>🚫 Не мыть двигатель без согласования</li>
<li>🗑 Мусор — в контейнеры у въезда</li>
</ul>
<p>Спасибо, что помогаете держать площадку в порядке! 🙏</p>
<p><i>Сообщение 10 из 10.</i></p>`,
  },
];

async function login() {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: ADMIN_LOGIN, password: ADMIN_PASSWORD }),
  });
  const json = await res.json();
  if (!json.success || !json.data?.accessToken) {
    throw new Error(`Login failed: ${json.error || res.statusText}`);
  }
  return json.data.accessToken;
}

async function api(token, method, path, body) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!json.success) {
    throw new Error(`${method} ${path}: ${json.error || res.statusText}`);
  }
  return json.data;
}

async function main() {
  const token = await login();
  const existing = await api(token, 'GET', '/api/crm/info-messages?limit=500');
  console.log(`API: ${API_URL}`);
  console.log(`Удаляем ${existing.length} публикаций…`);

  for (const row of existing) {
    await api(token, 'DELETE', `/api/crm/info-messages/${row.id}`);
  }

  const now = Date.now();
  const startMs = now - 10 * 60_000;

  console.log('Создаём 10 публикаций (HTML + картинки + эмодзи)…');
  const created = [];
  for (let i = 0; i < PUBLICATIONS.length; i++) {
    const item = PUBLICATIONS[i];
    const publishedAt = new Date(startMs + i * 60_000).toISOString();
    const row = await api(token, 'POST', '/api/crm/info-messages', {
      title: item.title,
      body: item.body,
      imageUrl: IMAGES[i % IMAGES.length],
      category: item.category,
      status: 'scheduled',
      publishedAt,
      sortOrder: PUBLICATIONS.length - i,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    created.push({ id: row.id, title: item.title });
    console.log(`  ${i + 1}/10 ${item.title}`);
  }

  console.log('\nГотово. VK публикатор отправит во VK только текст; картинки останутся в CRM/Telegram.');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
