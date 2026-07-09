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
const PROMOTION_EVERY = Number(process.env.PROMOTION_EVERY || 2);

const NEWS_TOPICS = [
  'обновление оборудования на постах',
  'новый режим мойки',
  'расширение графика работы',
  'улучшение освещения площадки',
  'запуск программы лояльности',
  'модернизация терминалов оплаты',
  'экологичный расход воды',
  'напоминание о правилах площадки',
  'сезонные рекомендации по уходу за авто',
  'итоги недели по посещаемости',
  'новый пост самообслуживания',
  'обновление меню Telegram-бота',
  'безопасность на въезде и выезде',
  'качество химии и расходников',
  'обслуживание пылесосной зоны',
  'подключение безналичной оплаты',
  'чистка дренажной системы',
  'контроль качества мойки',
  'обратная связь от клиентов',
  'подготовка к праздничным дням',
];

const PROMO_OFFERS = [
  'скидка 10% на утренние часы',
  'скидка 15% при оплате картой',
  'бесплатная сушка в выходные',
  'двойные баллы по карте лояльности',
  'скидка студентам по будням',
  'акция «Приведи друга»',
  'подарок за отзыв в Telegram',
  'бесплатная ополасковка колёс',
  'скидка пенсионерам',
  'ночная мойка со скидкой',
  'комплект «Пена + воск» выгоднее',
  'скидка на мойку мотоциклов',
  'бесплатные 5 минут пылесоса',
  'ароматизатор в подарок',
  'скидка 20% в день рождения',
  'третья мойка в месяц со скидкой',
  'семейный абонемент',
  'скидка на воскование',
  'бонус за безналичную оплату',
  'акция выходного дня',
];

const NEWS_INTROS = [
  'На автомойке',
  'Для наших клиентов',
  'Сообщаем',
  'Рады сообщить',
  'Информируем',
  'На площадке',
  'Важная новость',
  'Обратите внимание',
];

const PROMO_INTROS = [
  'Только сегодня',
  'Специальное предложение',
  'Выгодная акция',
  'Не пропустите',
  'Ограниченное время',
  'Для постоянных клиентов',
  'Сезонная акция',
  'Праздничное предложение',
];

const BODIES_NEWS = [
  'Следите за обновлениями в боте — здесь публикуются новости, акции и полезные напоминания.',
  'Мы продолжаем улучшать сервис, чтобы ваша мойка была быстрее и комфортнее.',
  'Используйте кнопку «Занятость» в боте, чтобы выбрать свободный пост без очереди.',
  'Благодарим за доверие и ждём вас на площадке в удобное время.',
  'Если заметили неисправность на посту — сообщите оператору или напишите в обратную связь.',
  'После мойки проверьте, что все окна и люки плотно закрыты перед выездом.',
  'Рекомендуем выдерживать режим «Пена» 1–2 минуты для лучшего результата.',
  'В пиковые часы удобнее приезжать утром или поздним вечером.',
];

const BODIES_PROMO = [
  'Акция действует на всех постах, если не указано иное. Успейте воспользоваться!',
  'Предложение суммируется с программой лояльности, если это разрешено правилами площадки.',
  'Скидка применяется при оплате на терминале в период действия акции.',
  'Покажите это сообщение оператору или выберите акцию в меню бота.',
  'Количество участников может быть ограничено — уточняйте на объекте.',
  'Подробности и сроки действия уточняйте у администратора автомойки.',
];

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

const IMAGES = [
  'https://picsum.photos/seed/washpro1/800/450',
  'https://picsum.photos/seed/washpro2/800/450',
  'https://picsum.photos/seed/washpro3/800/450',
  'https://picsum.photos/seed/washpro4/800/450',
  'https://picsum.photos/seed/washpro5/800/450',
];

function pick(arr, index) {
  return arr[index % arr.length];
}

function buildMessage(i, total) {
  const isPromotion = i % PROMOTION_EVERY === PROMOTION_EVERY - 1;
  const category = isPromotion ? 'promotion' : 'news';
  const title = isPromotion
    ? `${pick(PROMO_INTROS, i)}: ${pick(PROMO_OFFERS, i)}`
    : TITLES[i % TITLES.length] !== undefined && i < TITLES.length
      ? TITLES[i]
      : `${pick(NEWS_INTROS, i)}: ${pick(NEWS_TOPICS, i)}`;
  const bodyPool = isPromotion ? BODIES_PROMO : BODIES_NEWS;
  const body = `${pick(bodyPool, i)}\n\n<i>${isPromotion ? 'Акция' : 'Новость'} ${i + 1} из ${total}.</i>`;
  return { title, body, category };
}

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
  console.log(`Создаём ${COUNT} сообщений (новости + акции): первая через ${START_DELAY_MIN} мин, интервал ${INTERVAL_MIN} мин`);
  console.log(`Первая публикация (UTC+5): ${formatLocal(new Date(startMs).toISOString())}`);
  console.log(`Последняя (UTC+5): ${formatLocal(new Date(startMs + (COUNT - 1) * INTERVAL_MIN * 60_000).toISOString())}`);
  console.log('');

  const created = [];
  let newsCount = 0;
  let promoCount = 0;
  for (let i = 0; i < COUNT; i++) {
    const publishedAt = new Date(startMs + i * INTERVAL_MIN * 60_000).toISOString();
    const { title, body, category } = buildMessage(i, COUNT);
    if (category === 'promotion') promoCount += 1;
    else newsCount += 1;
    const row = await api(token, 'POST', '/api/crm/info-messages', {
      title,
      body,
      imageUrl: i % 4 === 0 ? IMAGES[i % IMAGES.length] : undefined,
      category,
      status: 'scheduled',
      publishedAt,
      sortOrder: COUNT - i,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    created.push({ id: row.id, title, publishedAt, category });
    if ((i + 1) % 10 === 0 || i === COUNT - 1) {
      console.log(`  ${i + 1}/${COUNT} создано…`);
    }
  }

  console.log('\nГотово.');
  console.log(`  Новостей: ${newsCount}, акций: ${promoCount}`);
  console.log('Примеры:');
  for (const row of created.slice(0, 3)) {
    console.log(`  • [${row.category}] ${row.title} → ${formatLocal(row.publishedAt)}`);
  }
  console.log(`  … и ещё ${COUNT - 3}`);
  console.log('\nБот покажет новости после наступления publishedAt (статус «По расписанию»).');
  console.log('Подписчики получат push-рассылку при появлении каждой новости (если уже писали /start).');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
