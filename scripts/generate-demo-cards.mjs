#!/usr/bin/env node
/**
 * Генерация демо-карт, привязанных к разным постам и автомойкам.
 * Использует существующие washes/posts в API.
 */

const API_URL = process.env.API_URL || 'http://localhost:3001';
const ADMIN_LOGIN = process.env.ADMIN_LOGIN || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin123!';

const REGULAR_COUNT = Number(process.env.CARD_REGULAR_COUNT || 45);
const SERVICE_COUNT = Number(process.env.CARD_SERVICE_COUNT || 30);
const VIP_COUNT = Number(process.env.CARD_VIP_COUNT || 25);

const CARD_STATUSES = ['success', 'success', 'success', 'rejected'];

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
  return arr[rand(0, arr.length - 1)];
}

function round2(n) {
  return Math.round(n * 100) / 100;
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

async function listAll(token, path) {
  const all = [];
  let page = 1;
  let totalPages = 1;
  while (page <= totalPages) {
    const json = await fetch(`${API_URL}${path}?page=${page}&limit=100`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => r.json());
    if (!json.success) throw new Error(`GET ${path}: ${json.error}`);
    all.push(...(json.data || []));
    totalPages = json.pagination?.totalPages ?? 1;
    page += 1;
  }
  return all;
}

function pickPost(posts) {
  return pick(posts);
}

function postWashId(post) {
  if (post.washId && typeof post.washId === 'object') return post.washId.id || post.washId._id;
  return post.washId;
}

async function createCard(token, body) {
  return api(token, 'POST', '/api/crm/cards', body);
}

async function deleteCard(token, id) {
  const res = await fetch(`${API_URL}/api/crm/cards/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  if (!json.success) {
    throw new Error(`DELETE /api/crm/cards/${id}: ${json.error || res.statusText}`);
  }
}

async function deleteAllCards(token) {
  const cards = await listAll(token, '/api/crm/cards');
  if (cards.length === 0) {
    console.log('No existing cards to delete');
    return 0;
  }
  console.log(`Deleting ${cards.length} existing cards…`);
  for (const card of cards) {
    await deleteCard(token, card.id);
  }
  console.log(`Deleted ${cards.length} cards`);
  return cards.length;
}

async function loadDiscountTypeCodes(token) {
  const types = await listAll(token, '/api/crm/discount-types');
  const codes = types
    .map((t) => String(t.code ?? t.number ?? '').trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, 'ru', { numeric: true, sensitivity: 'base' }));
  if (codes.length === 0) {
    throw new Error('Справочник типов скидок пуст — сначала запустите init-seed');
  }
  console.log(`Discount type codes: ${codes.join(', ')}`);
  return codes;
}

async function generateCards(token, posts, cardType, count, buildBody) {
  let created = 0;
  for (let i = 1; i <= count; i++) {
    const post = pickPost(posts);
    const washId = postWashId(post);
    const createdAt = new Date(Date.now() - rand(1, 180) * 86400000 - rand(0, 86400000)).toISOString();
    const body = buildBody(i, post, washId, createdAt);
    await createCard(token, body);
    created += 1;
    if (i % 15 === 0) console.log(`  ${cardType}: ${i}/${count}`);
  }
  return created;
}

async function main() {
  console.log(`API: ${API_URL}`);
  const token = await login();
  console.log('Admin login OK');

  await deleteAllCards(token);
  const discountTypeCodes = await loadDiscountTypeCodes(token);

  const [posts, washes] = await Promise.all([
    listAll(token, '/api/crm/posts'),
    listAll(token, '/api/crm/washes'),
  ]);
  const washIds = new Set(washes.map((w) => w.id));
  const validPosts = posts.filter((post) => washIds.has(postWashId(post)));
  if (validPosts.length === 0) {
    throw new Error('Нет постов с существующими автомойками — сначала запустите generate-demo-data.mjs');
  }
  if (validPosts.length < posts.length) {
    console.log(`Using ${validPosts.length}/${posts.length} posts (остальные ссылаются на удалённые автомойки)`);
  } else {
    console.log(`Found ${validPosts.length} posts`);
  }

  const regular = await generateCards(token, validPosts, 'regular', REGULAR_COUNT, (i, post, washId, createdAt) => ({
    cardNumber: `DISC-${String(i).padStart(5, '0')}`,
    cardType: 'regular',
    balance: round2(rand(100, 15000)),
    discount: round2(rand(50, 800)),
    discountType: discountTypeCodes[(i - 1) % discountTypeCodes.length],
    status: pick(CARD_STATUSES),
    washId,
    postId: post.id,
    createdAt,
  }));
  console.log(`Created ${regular} discount cards`);

  const service = await generateCards(token, validPosts, 'service', SERVICE_COUNT, (i, post, washId, createdAt) => {
    const validFrom = new Date(new Date(createdAt).getTime() - rand(1, 30) * 86400000).toISOString();
    const validUntil = new Date(new Date(validFrom).getTime() + rand(30, 365) * 86400000).toISOString();
    return {
      cardNumber: `SRV-${String(i).padStart(5, '0')}`,
      cardType: 'service',
      balance: 0,
      discount: 0,
      status: pick(CARD_STATUSES),
      washId,
      postId: post.id,
      createdAt,
      validFrom,
      validUntil,
    };
  });
  console.log(`Created ${service} service cards`);

  const vip = await generateCards(token, validPosts, 'unlimited', VIP_COUNT, (i, post, washId, createdAt) => {
    const validFrom = new Date(new Date(createdAt).getTime() - rand(0, 14) * 86400000).toISOString();
    const validUntil = new Date(new Date(validFrom).getTime() + rand(90, 730) * 86400000).toISOString();
    return {
      cardNumber: `VIP-${String(i).padStart(5, '0')}`,
      cardType: 'unlimited',
      balance: round2(rand(5000, 50000)),
      discount: 0,
      status: pick(CARD_STATUSES),
      washId,
      postId: post.id,
      createdAt,
      validFrom,
      validUntil,
    };
  });
  console.log(`Created ${vip} VIP cards`);

  console.log(`Done. Total cards: ${regular + service + vip}`);
}

main().catch((err) => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
