#!/usr/bin/env node
/**
 * Создаёт N информационных сообщений со статусом «По расписанию».
 * publishedAt: первая через START_DELAY_MIN, далее каждые INTERVAL_MIN минут.
 *
 * Использование:
 *   node scripts/seed-info-messages.mjs
 *   COUNT=50 START_DELAY_MIN=5 INTERVAL_MIN=10 node scripts/seed-info-messages.mjs
 */

const API_URL = process.env.API_URL || 'http://localhost:3001';
const ADMIN_LOGIN = process.env.ADMIN_LOGIN || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin123!';

const COUNT = Number(process.env.COUNT || 50);
const START_DELAY_MIN = Number(process.env.START_DELAY_MIN || 5);
const INTERVAL_MIN = Number(process.env.INTERVAL_MIN || 10);

const TITLES = [
  'Ночная мойка со скидкой',
  'Новый режим «Пена+воск»',
  'Бесплатная сушка в выходные',
  'Обновление цен на постах 3–5',
  'Акция для постоянных клиентов',
  'Открыт дополнительный пост',
  'Техобслуживание завершено',
  'Программа лояльности WASH PRO',
  'Скидка 15% на утренние часы',
  'Напоминание: берегите коврики',
  'Новый терминал безналичной оплаты',
  'Чистая вода — чистый автомобиль',
  'Режим «Антимошка» в сезон',
  'Подарок за отзыв в Telegram',
  'Перерыв на обед 13:00–14:00',
  'Пылесос: бесплатно 5 минут',
  'Обновление освещения на площадке',
  'Сезонная акция «Весна»',
  'Новые щётки на посту 2',
  'Карта лояльности: двойные баллы',
  'Рекомендуем мойку перед дальней поездкой',
  'Скидка студентам по будням',
  'Пост 1: краткий простой',
  'Воскование — защита ЛКП',
  'Бережная мойка для внедорожников',
  'Новый график работы в праздники',
  'Антибитумный состав в наличии',
  'Бесплатный осмотр давления в шинах',
  'Ароматизатор в подарок',
  'Эко-режим: меньше воды',
  'Очередь онлайн: смотрите «Занятость»',
  'Скидка на мойку мотоциклов',
  'Новый пост самообслуживания',
  'Чистка дисков в комплекте',
  'Акция «Приведи друга»',
  'Обновление меню бота',
  'Тёплая вода круглый год',
  'Скидка 10% при оплате картой',
  'Напоминание о правилах площадки',
  'Бесплатная ополасковка колёс',
  'Новый шампунь премиум-класса',
  'Режим «Экспресс» за 7 минут',
  'Парковка для ожидания расширена',
  'Скидка пенсионерам',
  'Мойка фар — улучшенная видимость',
  'Акция выходного дня',
  'Сервисные карты: продление срока',
  'Новости безопасности на площадке',
  'Благодарим за доверие',
  'Итоги недели: рекорд посещаемости',
];

const BODIES = [
  'Добро пожаловать! Следите за обновлениями в этом разделе — здесь публикуются новости автомойки, акции и полезные напоминания.',
  'Мы регулярно обновляем оборудование и программы мойки, чтобы ваш автомобиль оставался чистым быстрее и качественнее.',
  'Используйте кнопку «Занятость» в боте, чтобы выбрать свободный пост без ожидания в очереди.',
  'Оплата доступна наличными и картой. При безналичной оплате действуют специальные предложения.',
  'Пожалуйста, соблюдайте дистанцию на въезде и не оставляйте мусор на площадке после мойки.',
  'Для постоянных клиентов действует накопительная программа — спрашивайте администратора на объекте.',
  'В пиковые часы рекомендуем приезжать утром или поздним вечером — меньше очередь.',
  'Режим «Пена» рекомендуем выдерживать 1–2 минуты для лучшего результата.',
  'После мойки проверьте, что все окна и люки плотно закрыты перед выездом.',
  'Если заметили неисправность на посту — сообщите оператору или напишите в обратную связь.',
];

const IMAGES = [
  'https://picsum.photos/seed/washpro1/800/450',
  'https://picsum.photos/seed/washpro2/800/450',
  'https://picsum.photos/seed/washpro3/800/450',
  'https://picsum.photos/seed/washpro4/800/450',
  'https://picsum.photos/seed/washpro5/800/450',
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

function formatLocal(iso) {
  return new Date(iso).toLocaleString('ru-RU', { timeZone: 'Asia/Yekaterinburg' });
}

async function main() {
  const token = await login();
  const now = Date.now();
  const startMs = now + START_DELAY_MIN * 60_000;

  console.log(`API: ${API_URL}`);
  console.log(`Создаём ${COUNT} новостей: первая через ${START_DELAY_MIN} мин, интервал ${INTERVAL_MIN} мин`);
  console.log(`Первая публикация (UTC+5): ${formatLocal(new Date(startMs).toISOString())}`);
  console.log(`Последняя (UTC+5): ${formatLocal(new Date(startMs + (COUNT - 1) * INTERVAL_MIN * 60_000).toISOString())}`);
  console.log('');

  const created = [];
  for (let i = 0; i < COUNT; i++) {
    const publishedAt = new Date(startMs + i * INTERVAL_MIN * 60_000).toISOString();
    const title = `${TITLES[i % TITLES.length]} #${i + 1}`;
    const body = `${BODIES[i % BODIES.length]}\n\n<i>Тестовая новость ${i + 1} из ${COUNT}. Публикация: ${formatLocal(publishedAt)}.</i>`;
    const row = await api(token, 'POST', '/api/crm/info-messages', {
      title,
      body,
      imageUrl: i % 3 === 0 ? IMAGES[i % IMAGES.length] : undefined,
      category: i % 7 === 0 ? 'promotion' : 'news',
      status: 'scheduled',
      publishedAt,
      sortOrder: COUNT - i,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    created.push({ id: row.id, title, publishedAt });
    if ((i + 1) % 10 === 0 || i === COUNT - 1) {
      console.log(`  ${i + 1}/${COUNT} создано…`);
    }
  }

  console.log('\nГотово. Примеры:');
  for (const row of created.slice(0, 3)) {
    console.log(`  • ${row.title} → ${formatLocal(row.publishedAt)}`);
  }
  console.log(`  … и ещё ${COUNT - 3}`);
  console.log('\nБот покажет новости после наступления publishedAt (статус «По расписанию»).');
  console.log('Подписчики получат push-рассылку при появлении каждой новости (если уже писали /start).');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
