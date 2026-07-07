export interface SchemaField {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'datetime' | 'json' | 'reference';
  required?: boolean;
  description?: string;
  order?: number;
  /** Slug целевого GET-эндпоинта списка (для type=reference) */
  refEndpointSlug?: string;
}

export interface EndpointHandler {
  name: string;
  type: 'javascript';
  code: string;
  enabled: boolean;
}

export interface EndpointDef {
  name: string;
  description: string;
  slug: string;
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  schema: SchemaField[];
  accessType: 'public' | 'authenticated' | 'group';
  groupKey: string;
  handlers?: EndpointHandler[];
}

/** Общие JS-хелперы для каскадного удаления (встраиваются в handlers). */
const CASCADE_JS_HELPERS = `function refId(value) {
  if (value == null) return '';
  if (typeof value === 'object') return String(value.id || value._id || '');
  return String(value);
}

async function deleteByRefField(col, field, value) {
  const id = String(value || '');
  if (!id) return 0;
  return await col.deleteMany({
    $or: [
      { [field]: id },
      { [field + '.id']: id },
      { [field + '._id']: id },
    ],
  });
}

async function findRecordById(col, id) {
  const direct = await col.findOne({ id: id });
  if (direct) return direct;
  const first = await col.find({}, { page: 1, limit: 1 });
  const totalPages = first.pagination && first.pagination.totalPages ? first.pagination.totalPages : 1;
  for (let page = 1; page <= totalPages; page++) {
    const result = await col.find({}, { page: page, limit: 100 });
    const data = result.data || [];
    for (let i = 0; i < data.length; i++) {
      if (data[i].id === id) return data[i];
    }
  }
  return null;
}

async function findPostById(db, postId) {
  return findRecordById(db.at('/api/crm/posts'), postId);
}

async function listPostsByWashId(db, washId) {
  const col = db.at('/api/crm/posts');
  const posts = [];
  const first = await col.find({}, { page: 1, limit: 1 });
  const totalPages = first.pagination && first.pagination.totalPages ? first.pagination.totalPages : 1;
  for (let page = 1; page <= totalPages; page++) {
    const result = await col.find({}, { page: page, limit: 100 });
    const data = result.data || [];
    for (let i = 0; i < data.length; i++) {
      if (refId(data[i].washId) === washId) posts.push(data[i]);
    }
  }
  return posts;
}

async function purgeByPostId(db, postId, postSerial) {
  let deleted = 0;
  const pathsByPostId = [
    '/api/crm/post-states',
    '/api/crm/cards',
    '/api/crm/usage-stats',
    '/api/crm/finance-stats',
    '/api/crm/notifications',
  ];
  for (let i = 0; i < pathsByPostId.length; i++) {
    deleted += await deleteByRefField(db.at(pathsByPostId[i]), 'postId', postId);
  }
  deleted += await deleteByRefField(db.at('/api/crm/telemetry'), 'postId', postId);
  const serial = String(postSerial || '').trim();
  if (serial) {
    deleted += await db.at('/api/crm/telemetry').deleteMany({ postSerial: serial });
  }
  return deleted;
}

async function purgeByWashId(db, washId) {
  return deleteByRefField(db.at('/api/crm/notifications'), 'washId', washId);
}

async function deletePostsByWashId(db, washId) {
  return deleteByRefField(db.at('/api/crm/posts'), 'washId', washId);
}

async function writeDeleteLog(db, recordsAffected) {
  try {
    await db.at('/api/crm/archive-logs').create({
      action: 'delete',
      recordsAffected: recordsAffected,
      policyDays: 0,
      createdAt: new Date().toISOString(),
    });
  } catch (ignoreErr) {}
}`;

/** Каскадное удаление поста: состояния, карты, статистика, уведомления, телеметрия. */
export const POST_DELETE_CASCADE_HANDLER: EndpointHandler = {
  name: 'Cascade delete post data',
  type: 'javascript',
  enabled: true,
  code: `${CASCADE_JS_HELPERS}

async function handler(req, db) {
  const postId = req.params.id;
  const post = await findPostById(db, postId);
  if (!post) {
    return { status: 404, data: { success: false, error: 'Record not found' } };
  }
  try {
    const deletedRelated = await purgeByPostId(db, postId, post.serialNumber);
    await db.delete(postId);
    await writeDeleteLog(db, deletedRelated + 1);
    return {
      success: true,
      message: 'Post and related data deleted',
      deletedPosts: 1,
      deletedRelated: deletedRelated,
    };
  } catch (e) {
    const msg = e && e.message ? String(e.message) : 'Delete failed';
    if (msg.includes('not found')) {
      return { status: 404, data: { success: false, error: 'Record not found' } };
    }
    throw e;
  }
}`,
};

/** Каскадное удаление автомойки: все посты и их данные. */
export const WASH_DELETE_CASCADE_HANDLER: EndpointHandler = {
  name: 'Cascade delete wash and posts',
  type: 'javascript',
  enabled: true,
  code: `${CASCADE_JS_HELPERS}

async function handler(req, db) {
  const washId = req.params.id;
  const wash = await findRecordById(db, washId);
  if (!wash) {
    return { status: 404, data: { success: false, error: 'Record not found' } };
  }
  try {
    const posts = await listPostsByWashId(db, washId);
    let deletedRelated = 0;
    for (let i = 0; i < posts.length; i++) {
      const post = posts[i];
      deletedRelated += await purgeByPostId(db, post.id, post.serialNumber);
    }
    const deletedPosts = await deletePostsByWashId(db, washId);
    deletedRelated += await purgeByWashId(db, washId);
    await db.delete(washId);
    await writeDeleteLog(db, deletedRelated + deletedPosts + 1);
    return {
      success: true,
      message: 'Wash, posts and related data deleted',
      deletedPosts: deletedPosts,
      deletedRelated: deletedRelated,
    };
  } catch (e) {
    const msg = e && e.message ? String(e.message) : 'Delete failed';
    if (msg.includes('not found')) {
      return { status: 404, data: { success: false, error: 'Record not found' } };
    }
    throw e;
  }
}`,
};

/** Группы endpoints в панели Dynamic API */
export const ENDPOINT_GROUPS = [
  {
    key: 'washes',
    name: 'Автомойки',
    description: 'Управление автомойками самообслуживания',
    icon: 'building',
    color: '#0ea5e9',
    order: 10,
  },
  {
    key: 'posts',
    name: 'Посты',
    description: 'Посты и оборудование автомоек',
    icon: 'columns',
    color: '#6366f1',
    order: 11,
  },
  {
    key: 'scada',
    name: 'Состояние и SCADA',
    description: 'Текущее состояние постов и телеметрия в реальном времени',
    icon: 'activity',
    color: '#f59e0b',
    order: 12,
  },
  {
    key: 'cards',
    name: 'Карты клиентов',
    description: 'Клиентские карты, баланс и скидки',
    icon: 'credit-card',
    color: '#10b981',
    order: 13,
  },
  {
    key: 'statistics',
    name: 'Статистика',
    description: 'Использование и финансовые показатели',
    icon: 'bar-chart',
    color: '#8b5cf6',
    order: 14,
  },
  {
    key: 'currencies',
    name: 'Валюты',
    description: 'Справочник валют и валюта по умолчанию',
    icon: 'coins',
    color: '#eab308',
    order: 15,
  },
  {
    key: 'discount-types',
    name: 'Типы скидок',
    description: 'Справочник номеров и названий типов скидок для карт',
    icon: 'tag',
    color: '#f97316',
    order: 16,
  },
  {
    key: 'work-modes',
    name: 'Режимы работы',
    description: 'Справочник номеров программ и их названий для постов',
    icon: 'sliders-horizontal',
    color: '#0ea5e9',
    order: 17,
  },
  {
    key: 'settings',
    name: 'Настройки',
    description: 'Сеть, Telegram, уведомления и параметры системы',
    icon: 'settings',
    color: '#64748b',
    order: 18,
  },
  {
    key: 'notifications',
    name: 'Уведомления',
    description: 'События и оповещения',
    icon: 'bell',
    color: '#ec4899',
    order: 19,
  },
  {
    key: 'backup',
    name: 'Резервное копирование',
    description: 'Бэкапы и архивирование данных',
    icon: 'hard-drive',
    color: '#14b8a6',
    order: 20,
  },
  {
    key: 'telemetry',
    name: 'Телеметрия',
    description: 'Внутренний приём данных от контроллеров (message-processor)',
    icon: 'radio',
    color: '#ef4444',
    order: 21,
  },
] as const;

export type EndpointGroupKey = (typeof ENDPOINT_GROUPS)[number]['key'];

/** Устаревшая монолитная группа — удаляется при реорганизации */
export const LEGACY_ENDPOINT_GROUP = 'WASH PRO CRM';

export const CRM_GROUPS = [
  {
    name: 'Administrator',
    description: 'Полный доступ к CRM/SCADA',
    permissions: ['view', 'create', 'update', 'delete', 'manage_users', 'manage_api', 'view_logs'],
  },
  {
    name: 'Operator',
    description: 'Оператор автомойки — управление и мониторинг',
    permissions: ['view', 'create', 'update'],
  },
  {
    name: 'Viewer',
    description: 'Только просмотр данных',
    permissions: ['view'],
  },
  {
    name: 'Service',
    description: 'Внутренние сервисы (processor, bot, backup)',
    permissions: ['view', 'create', 'update', 'delete', 'manage_api'],
  },
];

const washFields: SchemaField[] = [
  { name: 'name', type: 'string', required: true, order: 0, description: 'Название автомойки' },
  { name: 'description', type: 'string', order: 1, description: 'Описание' },
  { name: 'address', type: 'string', required: true, order: 2, description: 'Адрес' },
  { name: 'registeredAt', type: 'datetime', order: 3, description: 'Дата создания' },
  { name: 'cloudEnabled', type: 'boolean', order: 4, description: 'Подключение к облаку' },
];

const postFields: SchemaField[] = [
  { name: 'washId', type: 'reference', refEndpointSlug: 'crm-washes-list', required: true, order: 0, description: 'Автомойка' },
  { name: 'postNumber', type: 'number', required: true, order: 1, description: 'Номер поста' },
  { name: 'name', type: 'string', required: true, order: 2, description: 'Название поста' },
  { name: 'serialNumber', type: 'string', required: true, order: 3, description: 'Серийный номер' },
  { name: 'settings', type: 'json', order: 4, description: 'Настройки поста' },
  { name: 'createdAt', type: 'datetime', order: 5, description: 'Дата создания' },
];

const postStateFields: SchemaField[] = [
  { name: 'postId', type: 'reference', refEndpointSlug: 'crm-posts-list', required: true, order: 0, description: 'Пост' },
  { name: 'washId', type: 'reference', refEndpointSlug: 'crm-washes-list', required: true, order: 1, description: 'Автомойка' },
  { name: 'mode', type: 'string', order: 2, description: 'Режим работы' },
  { name: 'modeName', type: 'string', order: 3, description: 'Название режима' },
  { name: 'modeNumber', type: 'number', order: 4, description: 'Номер режима' },
  { name: 'freePause', type: 'number', order: 5, description: 'Бесплатная пауза (сек)' },
  { name: 'paidPause', type: 'number', order: 6, description: 'Платная пауза (сек)' },
  { name: 'balance', type: 'number', order: 7, description: 'Текущий баланс' },
  { name: 'discount', type: 'number', order: 8, description: 'Сумма скидки' },
  { name: 'modeTime', type: 'number', order: 9, description: 'Время работы режима (сек)' },
  { name: 'equipmentState', type: 'json', order: 10, description: 'Состояние оборудования' },
  { name: 'lastMessageAt', type: 'datetime', order: 11, description: 'Время последнего сообщения' },
  { name: 'connected', type: 'boolean', order: 12, description: 'Связь с постом' },
];

const cardFields: SchemaField[] = [
  { name: 'cardNumber', type: 'string', required: true, order: 0 },
  { name: 'cardType', type: 'string', required: true, order: 1, description: 'regular|unlimited|service|collection' },
  { name: 'balance', type: 'number', order: 2 },
  { name: 'discount', type: 'number', order: 3 },
  { name: 'discountType', type: 'string', order: 4, description: 'Код типа скидки из справочника' },
  { name: 'status', type: 'string', order: 5, description: 'success|rejected' },
  { name: 'washId', type: 'reference', refEndpointSlug: 'crm-washes-list', order: 6, description: 'Автомойка' },
  { name: 'postId', type: 'reference', refEndpointSlug: 'crm-posts-list', order: 7, description: 'Пост' },
  { name: 'createdAt', type: 'datetime', order: 8 },
  { name: 'validFrom', type: 'datetime', order: 9 },
  { name: 'validUntil', type: 'datetime', order: 10 },
];

const usageStatsFields: SchemaField[] = [
  { name: 'washId', type: 'reference', refEndpointSlug: 'crm-washes-list', required: true, order: 0, description: 'Автомойка' },
  { name: 'postId', type: 'reference', refEndpointSlug: 'crm-posts-list', order: 1, description: 'Пост' },
  { name: 'period', type: 'string', required: true, order: 2, description: 'before_collection|after_collection' },
  { name: 'category', type: 'string', required: true, order: 3, description: 'regular|unlimited|service' },
  { name: 'launchCount', type: 'number', order: 4 },
  { name: 'usageTime', type: 'number', order: 5, description: 'Секунды' },
  { name: 'avgWashTime', type: 'number', order: 6 },
  { name: 'clientCount', type: 'number', order: 7 },
  { name: 'recordedAt', type: 'datetime', order: 8 },
];

const financeStatsFields: SchemaField[] = [
  { name: 'washId', type: 'reference', refEndpointSlug: 'crm-washes-list', required: true, order: 0, description: 'Автомойка' },
  { name: 'postId', type: 'reference', refEndpointSlug: 'crm-posts-list', order: 1, description: 'Пост' },
  { name: 'period', type: 'string', required: true, order: 2, description: 'before_collection|after_collection' },
  { name: 'cash', type: 'number', order: 3 },
  { name: 'cashless', type: 'number', order: 4 },
  { name: 'discountOps', type: 'number', order: 5 },
  { name: 'totalRevenue', type: 'number', order: 6 },
  { name: 'avgCheck', type: 'number', order: 7 },
  { name: 'recordedAt', type: 'datetime', order: 8 },
];

const settingsFields: SchemaField[] = [
  { name: 'key', type: 'string', required: true, order: 0, description: 'backup|archive|telegram|notifications|pyorchestrator|dynamic-api' },
  { name: 'value', type: 'json', required: true, order: 1 },
];

const notificationFields: SchemaField[] = [
  { name: 'type', type: 'string', required: true, order: 0, description: 'connection_lost|equipment_error|queue_overflow|backup_error' },
  { name: 'severity', type: 'string', order: 1, description: 'info|warning|error' },
  { name: 'washId', type: 'reference', refEndpointSlug: 'crm-washes-list', order: 2, description: 'Автомойка' },
  { name: 'postId', type: 'reference', refEndpointSlug: 'crm-posts-list', order: 3, description: 'Пост' },
  { name: 'message', type: 'string', required: true, order: 4 },
  { name: 'read', type: 'boolean', order: 5 },
  { name: 'channels', type: 'array', order: 6, description: 'telegram|web' },
  { name: 'createdAt', type: 'datetime', order: 7 },
];

const backupFields: SchemaField[] = [
  { name: 'filename', type: 'string', required: true, order: 0 },
  { name: 'size', type: 'number', order: 1 },
  { name: 'type', type: 'string', order: 2, description: 'manual|auto' },
  { name: 'status', type: 'string', order: 3, description: 'completed|failed|in_progress' },
  { name: 'createdAt', type: 'datetime', order: 4 },
  { name: 'error', type: 'string', order: 5 },
];

const archiveLogFields: SchemaField[] = [
  { name: 'action', type: 'string', required: true, order: 0, description: 'archive|delete|transfer' },
  { name: 'recordsAffected', type: 'number', order: 1 },
  { name: 'policyDays', type: 'number', order: 2 },
  { name: 'createdAt', type: 'datetime', order: 3 },
  { name: 'filename', type: 'string', order: 4, description: 'Имя файла архива (.json.gz)' },
  { name: 'details', type: 'json', order: 5 },
];

const telemetryFields: SchemaField[] = [
  { name: 'mqttTopic', type: 'string', order: 0, description: 'MQTT-топик' },
  { name: 'washSerial', type: 'string', order: 1 },
  { name: 'postSerial', type: 'string', order: 2 },
  { name: 'messageType', type: 'string', required: true, order: 3 },
  { name: 'payload', type: 'json', required: true, order: 4 },
  { name: 'receivedAt', type: 'datetime', order: 5 },
];

const currencyFields: SchemaField[] = [
  { name: 'code', type: 'string', required: true, order: 0, description: 'Код ISO 4217 (RUB, USD, EUR)' },
  { name: 'name', type: 'string', required: true, order: 1, description: 'Название валюты' },
  { name: 'symbol', type: 'string', required: true, order: 2, description: 'Символ (₽, $, €)' },
  { name: 'isDefault', type: 'boolean', order: 3, description: 'Валюта по умолчанию для отображения' },
  { name: 'createdAt', type: 'datetime', order: 4, description: 'Дата создания' },
];

const discountTypeFields: SchemaField[] = [
  { name: 'code', type: 'string', required: true, order: 0, description: 'Код типа скидки' },
  { name: 'name', type: 'string', required: true, order: 1, description: 'Название типа скидки' },
  { name: 'status', type: 'string', order: 2, description: 'active|inactive' },
  { name: 'createdAt', type: 'datetime', order: 3 },
];

const workModeFields: SchemaField[] = [
  { name: 'code', type: 'string', required: true, order: 0, description: 'Код режима работы' },
  { name: 'name', type: 'string', required: true, order: 1, description: 'Название режима работы' },
  { name: 'modeType', type: 'string', order: 2, description: 'system|user — системный или пользовательский' },
  { name: 'status', type: 'string', order: 3, description: 'active|inactive' },
  { name: 'createdAt', type: 'datetime', order: 4 },
];

export const CRM_ENDPOINTS: EndpointDef[] = [
  { name: 'Список автомоек', slug: 'crm-washes-list', path: '/api/crm/washes', method: 'GET', schema: [], accessType: 'authenticated', groupKey: 'washes', description: 'Получить список автомоек' },
  { name: 'Создать автомойку', slug: 'crm-washes-create', path: '/api/crm/washes', method: 'POST', schema: washFields, accessType: 'group', groupKey: 'washes', description: 'Создать автомойку' },
  { name: 'Автомойка по ID', slug: 'crm-washes-get', path: '/api/crm/washes/:id', method: 'GET', schema: washFields, accessType: 'authenticated', groupKey: 'washes', description: 'Получить автомойку' },
  { name: 'Обновить автомойку', slug: 'crm-washes-update', path: '/api/crm/washes/:id', method: 'PUT', schema: washFields, accessType: 'group', groupKey: 'washes', description: 'Обновить автомойку' },
  { name: 'Удалить автомойку', slug: 'crm-washes-delete', path: '/api/crm/washes/:id', method: 'DELETE', schema: [], accessType: 'group', groupKey: 'washes', description: 'Удалить автомойку, все посты и связанные данные', handlers: [WASH_DELETE_CASCADE_HANDLER] },

  { name: 'Список постов', slug: 'crm-posts-list', path: '/api/crm/posts', method: 'GET', schema: postFields, accessType: 'authenticated', groupKey: 'posts', description: 'Получить список постов' },
  { name: 'Создать пост', slug: 'crm-posts-create', path: '/api/crm/posts', method: 'POST', schema: postFields, accessType: 'group', groupKey: 'posts', description: 'Создать пост' },
  { name: 'Пост по ID', slug: 'crm-posts-get', path: '/api/crm/posts/:id', method: 'GET', schema: postFields, accessType: 'authenticated', groupKey: 'posts', description: 'Получить пост' },
  { name: 'Обновить пост', slug: 'crm-posts-update', path: '/api/crm/posts/:id', method: 'PUT', schema: postFields, accessType: 'group', groupKey: 'posts', description: 'Обновить пост' },
  { name: 'Удалить пост', slug: 'crm-posts-delete', path: '/api/crm/posts/:id', method: 'DELETE', schema: [], accessType: 'group', groupKey: 'posts', description: 'Удалить пост и связанные данные', handlers: [POST_DELETE_CASCADE_HANDLER] },

  { name: 'Состояние поста', slug: 'crm-post-states-list', path: '/api/crm/post-states', method: 'GET', schema: postStateFields, accessType: 'authenticated', groupKey: 'scada', description: 'Список состояний постов' },
  { name: 'Создать состояние', slug: 'crm-post-states-create', path: '/api/crm/post-states', method: 'POST', schema: postStateFields, accessType: 'group', groupKey: 'scada', description: 'Создать состояние поста' },
  { name: 'Состояние по ID', slug: 'crm-post-states-get', path: '/api/crm/post-states/:id', method: 'GET', schema: postStateFields, accessType: 'authenticated', groupKey: 'scada', description: 'Получить состояние' },
  { name: 'Обновить состояние', slug: 'crm-post-states-update', path: '/api/crm/post-states/:id', method: 'PUT', schema: postStateFields, accessType: 'group', groupKey: 'scada', description: 'Обновить состояние поста' },
  { name: 'Частичное обновление состояния', slug: 'crm-post-states-patch', path: '/api/crm/post-states/:id', method: 'PATCH', schema: postStateFields, accessType: 'group', groupKey: 'scada', description: 'Частичное обновление' },
  { name: 'Удалить состояние поста', slug: 'crm-post-states-delete', path: '/api/crm/post-states/:id', method: 'DELETE', schema: [], accessType: 'group', groupKey: 'scada', description: 'Удалить состояние поста' },

  { name: 'Список карт', slug: 'crm-cards-list', path: '/api/crm/cards', method: 'GET', schema: cardFields, accessType: 'authenticated', groupKey: 'cards', description: 'Список карт клиентов' },
  { name: 'Создать карту', slug: 'crm-cards-create', path: '/api/crm/cards', method: 'POST', schema: cardFields, accessType: 'group', groupKey: 'cards', description: 'Создать карту' },
  { name: 'Карта по ID', slug: 'crm-cards-get', path: '/api/crm/cards/:id', method: 'GET', schema: cardFields, accessType: 'authenticated', groupKey: 'cards', description: 'Получить карту' },
  { name: 'Обновить карту', slug: 'crm-cards-update', path: '/api/crm/cards/:id', method: 'PUT', schema: cardFields, accessType: 'group', groupKey: 'cards', description: 'Обновить карту' },
  { name: 'Удалить карту', slug: 'crm-cards-delete', path: '/api/crm/cards/:id', method: 'DELETE', schema: [], accessType: 'group', groupKey: 'cards', description: 'Удалить карту' },

  { name: 'Статистика использования', slug: 'crm-usage-stats-list', path: '/api/crm/usage-stats', method: 'GET', schema: usageStatsFields, accessType: 'authenticated', groupKey: 'statistics', description: 'Статистика использования' },
  { name: 'Записать статистику', slug: 'crm-usage-stats-create', path: '/api/crm/usage-stats', method: 'POST', schema: usageStatsFields, accessType: 'group', groupKey: 'statistics', description: 'Записать статистику' },
  { name: 'Обновить статистику', slug: 'crm-usage-stats-update', path: '/api/crm/usage-stats/:id', method: 'PATCH', schema: usageStatsFields, accessType: 'group', groupKey: 'statistics', description: 'Обновить статистику использования' },
  { name: 'Удалить статистику использования', slug: 'crm-usage-stats-delete', path: '/api/crm/usage-stats/:id', method: 'DELETE', schema: [], accessType: 'group', groupKey: 'statistics', description: 'Удалить запись статистики' },

  { name: 'Финансовая статистика', slug: 'crm-finance-stats-list', path: '/api/crm/finance-stats', method: 'GET', schema: financeStatsFields, accessType: 'authenticated', groupKey: 'statistics', description: 'Финансовая статистика' },
  { name: 'Записать финансы', slug: 'crm-finance-stats-create', path: '/api/crm/finance-stats', method: 'POST', schema: financeStatsFields, accessType: 'group', groupKey: 'statistics', description: 'Записать финансы' },
  { name: 'Обновить финансы', slug: 'crm-finance-stats-update', path: '/api/crm/finance-stats/:id', method: 'PATCH', schema: financeStatsFields, accessType: 'group', groupKey: 'statistics', description: 'Обновить финансовую статистику' },
  { name: 'Удалить финансовую статистику', slug: 'crm-finance-stats-delete', path: '/api/crm/finance-stats/:id', method: 'DELETE', schema: [], accessType: 'group', groupKey: 'statistics', description: 'Удалить запись финансов' },

  { name: 'Список валют', slug: 'crm-currencies-list', path: '/api/crm/currencies', method: 'GET', schema: [], accessType: 'authenticated', groupKey: 'currencies', description: 'Справочник валют' },
  { name: 'Создать валюту', slug: 'crm-currencies-create', path: '/api/crm/currencies', method: 'POST', schema: currencyFields, accessType: 'group', groupKey: 'currencies', description: 'Добавить валюту' },
  { name: 'Валюта по ID', slug: 'crm-currencies-get', path: '/api/crm/currencies/:id', method: 'GET', schema: [], accessType: 'authenticated', groupKey: 'currencies', description: 'Получить валюту' },
  { name: 'Обновить валюту', slug: 'crm-currencies-update', path: '/api/crm/currencies/:id', method: 'PUT', schema: currencyFields, accessType: 'group', groupKey: 'currencies', description: 'Обновить валюту' },
  { name: 'Удалить валюту', slug: 'crm-currencies-delete', path: '/api/crm/currencies/:id', method: 'DELETE', schema: [], accessType: 'group', groupKey: 'currencies', description: 'Удалить валюту' },

  { name: 'Список типов скидок', slug: 'crm-discount-types-list', path: '/api/crm/discount-types', method: 'GET', schema: [], accessType: 'authenticated', groupKey: 'discount-types', description: 'Справочник типов скидок' },
  { name: 'Создать тип скидки', slug: 'crm-discount-types-create', path: '/api/crm/discount-types', method: 'POST', schema: discountTypeFields, accessType: 'group', groupKey: 'discount-types', description: 'Добавить тип скидки' },
  { name: 'Тип скидки по ID', slug: 'crm-discount-types-get', path: '/api/crm/discount-types/:id', method: 'GET', schema: [], accessType: 'authenticated', groupKey: 'discount-types', description: 'Получить тип скидки' },
  { name: 'Обновить тип скидки', slug: 'crm-discount-types-update', path: '/api/crm/discount-types/:id', method: 'PUT', schema: discountTypeFields, accessType: 'group', groupKey: 'discount-types', description: 'Обновить тип скидки' },
  { name: 'Удалить тип скидки', slug: 'crm-discount-types-delete', path: '/api/crm/discount-types/:id', method: 'DELETE', schema: [], accessType: 'group', groupKey: 'discount-types', description: 'Удалить тип скидки' },

  { name: 'Список режимов работы', slug: 'crm-work-modes-list', path: '/api/crm/work-modes', method: 'GET', schema: [], accessType: 'authenticated', groupKey: 'work-modes', description: 'Справочник режимов работы постов' },
  { name: 'Создать режим работы', slug: 'crm-work-modes-create', path: '/api/crm/work-modes', method: 'POST', schema: workModeFields, accessType: 'group', groupKey: 'work-modes', description: 'Добавить режим работы' },
  { name: 'Режим работы по ID', slug: 'crm-work-modes-get', path: '/api/crm/work-modes/:id', method: 'GET', schema: [], accessType: 'authenticated', groupKey: 'work-modes', description: 'Получить режим работы' },
  { name: 'Обновить режим работы', slug: 'crm-work-modes-update', path: '/api/crm/work-modes/:id', method: 'PUT', schema: workModeFields, accessType: 'group', groupKey: 'work-modes', description: 'Обновить режим работы' },
  { name: 'Удалить режим работы', slug: 'crm-work-modes-delete', path: '/api/crm/work-modes/:id', method: 'DELETE', schema: [], accessType: 'group', groupKey: 'work-modes', description: 'Удалить режим работы' },

  { name: 'Настройки CRM', slug: 'crm-settings-list', path: '/api/crm/settings', method: 'GET', schema: [], accessType: 'authenticated', groupKey: 'settings', description: 'Получить настройки' },
  { name: 'Сохранить настройки', slug: 'crm-settings-create', path: '/api/crm/settings', method: 'POST', schema: settingsFields, accessType: 'group', groupKey: 'settings', description: 'Сохранить настройки' },
  { name: 'Обновить настройки', slug: 'crm-settings-update', path: '/api/crm/settings/:id', method: 'PUT', schema: settingsFields, accessType: 'group', groupKey: 'settings', description: 'Обновить настройки' },

  { name: 'Уведомления', slug: 'crm-notifications-list', path: '/api/crm/notifications', method: 'GET', schema: [], accessType: 'authenticated', groupKey: 'notifications', description: 'Список уведомлений' },
  { name: 'Создать уведомление', slug: 'crm-notifications-create', path: '/api/crm/notifications', method: 'POST', schema: notificationFields, accessType: 'group', groupKey: 'notifications', description: 'Создать уведомление' },
  { name: 'Обновить уведомление', slug: 'crm-notifications-update', path: '/api/crm/notifications/:id', method: 'PATCH', schema: notificationFields, accessType: 'group', groupKey: 'notifications', description: 'Обновить уведомление' },
  { name: 'Удалить уведомление', slug: 'crm-notifications-delete', path: '/api/crm/notifications/:id', method: 'DELETE', schema: [], accessType: 'authenticated', groupKey: 'notifications', description: 'Удалить уведомление' },

  { name: 'Резервные копии', slug: 'crm-backups-list', path: '/api/crm/backups', method: 'GET', schema: [], accessType: 'group', groupKey: 'backup', description: 'Список резервных копий' },
  { name: 'Создать запись бэкапа', slug: 'crm-backups-create', path: '/api/crm/backups', method: 'POST', schema: backupFields, accessType: 'group', groupKey: 'backup', description: 'Зарегистрировать бэкап' },
  { name: 'Обновить бэкап', slug: 'crm-backups-update', path: '/api/crm/backups/:id', method: 'PATCH', schema: backupFields, accessType: 'group', groupKey: 'backup', description: 'Обновить статус бэкапа' },
  { name: 'Удалить бэкап', slug: 'crm-backups-delete', path: '/api/crm/backups/:id', method: 'DELETE', schema: [], accessType: 'group', groupKey: 'backup', description: 'Удалить запись резервной копии' },

  { name: 'Журнал архивирования', slug: 'crm-archive-logs-list', path: '/api/crm/archive-logs', method: 'GET', schema: [], accessType: 'authenticated', groupKey: 'backup', description: 'Журнал архивирования' },
  { name: 'Записать архивирование', slug: 'crm-archive-logs-create', path: '/api/crm/archive-logs', method: 'POST', schema: archiveLogFields, accessType: 'group', groupKey: 'backup', description: 'Записать операцию архива' },
  { name: 'Удалить запись архива', slug: 'crm-archive-logs-delete', path: '/api/crm/archive-logs/:id', method: 'DELETE', schema: [], accessType: 'authenticated', groupKey: 'backup', description: 'Удалить запись журнала архивирования' },

  { name: 'Телеметрия (внутр.)', slug: 'crm-telemetry-create', path: '/api/crm/telemetry', method: 'POST', schema: telemetryFields, accessType: 'group', groupKey: 'telemetry', description: 'Приём телеметрии от processor' },
  { name: 'Список телеметрии', slug: 'crm-telemetry-list', path: '/api/crm/telemetry', method: 'GET', schema: [], accessType: 'authenticated', groupKey: 'telemetry', description: 'Список входящих MQTT-сообщений' },
  { name: 'Удалить телеметрию', slug: 'crm-telemetry-delete', path: '/api/crm/telemetry/:id', method: 'DELETE', schema: [], accessType: 'group', groupKey: 'telemetry', description: 'Удаление при архивировании' },
];

export const DEFAULT_SETTINGS = [
  {
    key: 'backup',
    value: {
      enabled: true,
      cron: '0 2 * * *',
      retentionCount: 7,
      storagePath: '/backups',
    },
  },
  {
    key: 'archive',
    value: {
      retentionDays: 90,
      autoArchive: true,
      autoDelete: false,
      cards: { enabled: true, autoRun: false, saveArchive: true, deleteAfter: false, retentionDays: 90, policy: 'standard' },
      postStates: { enabled: true, autoRun: false, saveArchive: true, deleteAfter: false, retentionDays: 90, policy: 'standard' },
      usageStats: { enabled: true, autoRun: false, saveArchive: true, deleteAfter: false, retentionDays: 90, policy: 'standard' },
      financeStats: { enabled: true, autoRun: false, saveArchive: true, deleteAfter: false, retentionDays: 90, policy: 'standard' },
    },
  },
  {
    key: 'telegram',
    value: {
      token: '',
      adminIds: [],
      allowedCommands: ['/status', '/washes', '/posts', '/revenue', '/statistics', '/cards'],
      enabled: false,
    },
  },
  {
    key: 'pyorchestrator',
    value: {
      email: 'admin@pyorchestrator.local',
      password: 'admin',
      panelPort: 8090,
    },
  },
  {
    key: 'dynamic-api',
    value: {
      serviceLogin: 'service',
      servicePassword: 'ServiceInternal123!',
      apiBaseUrl: 'http://dynamic-api:3001',
    },
  },
  {
    key: 'notifications',
    value: {
      telegram: true,
      web: true,
      events: {
        connectionLost: false,
        equipmentError: false,
        queueOverflow: true,
        backupSuccess: true,
        backupError: true,
        archiveSuccess: true,
        archiveError: true,
        telegramBotCreated: true,
        telegramBotError: true,
        userLogin: true,
        userLogout: true,
        userPasswordChanged: true,
        userCreated: true,
        userUpdated: true,
        userDeleted: true,
        washCreated: true,
        washUpdated: true,
        washDeleted: true,
        postCreated: true,
        postUpdated: true,
        postDeleted: true,
        settingsUpdated: true,
        currencyCreated: true,
        currencyUpdated: true,
        currencyDeleted: true,
        discountTypeUpdated: true,
        workModeUpdated: true,
        cardCreated: true,
        cardUpdated: true,
        cardDeleted: true,
        autoTask: true,
      },
    },
  },
  {
    key: 'setup',
    value: {
      complete: false,
      skippedSteps: [],
    },
  },
];

export const DEFAULT_CURRENCIES = [
  { code: 'RUB', name: 'Российский рубль', symbol: '₽', isDefault: true },
  { code: 'BYN', name: 'Белорусский рубль', symbol: 'Br', isDefault: false },
  { code: 'KZT', name: 'Казахстанский тенге', symbol: '₸', isDefault: false },
  { code: 'UAH', name: 'Украинская гривна', symbol: '₴', isDefault: false },
  { code: 'UZS', name: 'Узбекский сум', symbol: 'сум', isDefault: false },
  { code: 'TJS', name: 'Таджикский сомони', symbol: 'SM', isDefault: false },
  { code: 'KGS', name: 'Киргизский сом', symbol: 'с', isDefault: false },
  { code: 'AMD', name: 'Армянский драм', symbol: '֏', isDefault: false },
  { code: 'AZN', name: 'Азербайджанский манат', symbol: '₼', isDefault: false },
  { code: 'MDL', name: 'Молдавский лей', symbol: 'L', isDefault: false },
  { code: 'TMT', name: 'Туркменский манат', symbol: 'm', isDefault: false },
  { code: 'GEL', name: 'Грузинский лари', symbol: '₾', isDefault: false },
  { code: 'TRY', name: 'Турецкая лира', symbol: '₺', isDefault: false },
  { code: 'EUR', name: 'Евро', symbol: '€', isDefault: false },
  { code: 'USD', name: 'Доллар США', symbol: '$', isDefault: false },
  { code: 'CNY', name: 'Китайский юань', symbol: '¥', isDefault: false },
];

export const DEFAULT_DISCOUNT_TYPES = [
  { code: '1', name: 'Карта такси', status: 'active' },
  { code: '2', name: 'Постоянный клиент', status: 'active' },
  { code: '3', name: 'Корпоративный клиент', status: 'active' },
  { code: '4', name: 'Сотрудник', status: 'active' },
  { code: '5', name: 'Промоакция', status: 'active' },
];

export const DEFAULT_WORK_MODES = [
  { code: '0', name: 'Вода', modeType: 'system', status: 'active' },
  { code: '1', name: 'Пена', modeType: 'system', status: 'active' },
  { code: '2', name: 'Шампунь', modeType: 'system', status: 'active' },
  { code: '3', name: 'Воск', modeType: 'system', status: 'active' },
  { code: '4', name: 'Ополаскивание', modeType: 'system', status: 'active' },
  { code: '5', name: 'Сушка', modeType: 'system', status: 'active' },
  { code: '6', name: 'Пылесос', modeType: 'system', status: 'active' },
  { code: '7', name: 'Антибитум', modeType: 'system', status: 'active' },
  { code: '8', name: 'Резина', modeType: 'system', status: 'active' },
  { code: '9', name: 'Дворники', modeType: 'system', status: 'active' },
];

/** Демо-объект, если в БД нет ни одной автомойки (восстановление после удаления). */
export const DEFAULT_DEMO_WASH = {
  name: 'Автомойка «Центральная»',
  description: 'Демо-объект самообслуживания',
  address: 'г. Москва, ул. Примерная, 1',
  cloudEnabled: true,
};

export const DEFAULT_DEMO_POSTS = [
  {
    postNumber: 1,
    name: 'Пост 1',
    serialNumber: 'WP-POST-001',
    settings: {
      firmwareVersion: '1.0.0',
      warrantyUntil: '2027-12-31',
      mqttLogin: 'WP-POST-001',
      mqttPassword: 'demo_mqtt_wp001',
    },
  },
  {
    postNumber: 2,
    name: 'Пост 2',
    serialNumber: 'WP-POST-002',
    settings: {
      firmwareVersion: '1.0.0',
      warrantyUntil: '2027-12-31',
      mqttLogin: 'WP-POST-002',
      mqttPassword: 'demo_mqtt_wp002',
    },
  },
] as const;
