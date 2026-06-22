export interface SchemaField {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'datetime' | 'json';
  required?: boolean;
  description?: string;
  order?: number;
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
}

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
    key: 'settings',
    name: 'Настройки',
    description: 'Сеть, Telegram, уведомления и параметры системы',
    icon: 'settings',
    color: '#64748b',
    order: 15,
  },
  {
    key: 'notifications',
    name: 'Уведомления',
    description: 'События и оповещения',
    icon: 'bell',
    color: '#ec4899',
    order: 16,
  },
  {
    key: 'backup',
    name: 'Резервное копирование',
    description: 'Бэкапы и архивирование данных',
    icon: 'hard-drive',
    color: '#14b8a6',
    order: 17,
  },
  {
    key: 'telemetry',
    name: 'Телеметрия',
    description: 'Внутренний приём данных от контроллеров (message-processor)',
    icon: 'radio',
    color: '#ef4444',
    order: 18,
  },
] as const;

export type EndpointGroupKey = (typeof ENDPOINT_GROUPS)[number]['key'];

/** Устаревшая монолитная группа — удаляется при реорганизации */
export const LEGACY_ENDPOINT_GROUP = 'WASH CRM';

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
  { name: 'registeredAt', type: 'datetime', order: 3, description: 'Дата регистрации' },
  { name: 'cloudEnabled', type: 'boolean', order: 4, description: 'Подключение к облаку' },
];

const postFields: SchemaField[] = [
  { name: 'washId', type: 'string', required: true, order: 0, description: 'ID автомойки' },
  { name: 'postNumber', type: 'number', required: true, order: 1, description: 'Номер поста' },
  { name: 'name', type: 'string', required: true, order: 2, description: 'Название поста' },
  { name: 'serialNumber', type: 'string', required: true, order: 3, description: 'Серийный номер' },
  { name: 'status', type: 'string', required: true, order: 4, description: 'Статус: online|offline|error|maintenance' },
  { name: 'settings', type: 'json', order: 5, description: 'Настройки поста' },
];

const postStateFields: SchemaField[] = [
  { name: 'postId', type: 'string', required: true, order: 0 },
  { name: 'washId', type: 'string', required: true, order: 1 },
  { name: 'mode', type: 'string', order: 2, description: 'Режим работы' },
  { name: 'modeName', type: 'string', order: 3, description: 'Название режима' },
  { name: 'modeNumber', type: 'number', order: 4, description: 'Номер режима' },
  { name: 'freePause', type: 'number', order: 5, description: 'Бесплатная пауза (сек)' },
  { name: 'paidPause', type: 'number', order: 6, description: 'Платная пауза (сек)' },
  { name: 'modeTime', type: 'number', order: 7, description: 'Время работы режима (сек)' },
  { name: 'equipmentState', type: 'json', order: 8, description: 'Состояние оборудования' },
  { name: 'lastMessageAt', type: 'datetime', order: 9, description: 'Время последнего сообщения' },
  { name: 'connected', type: 'boolean', order: 10, description: 'Связь с постом' },
];

const cardFields: SchemaField[] = [
  { name: 'cardNumber', type: 'string', required: true, order: 0 },
  { name: 'cardType', type: 'string', required: true, order: 1, description: 'regular|unlimited|service' },
  { name: 'balance', type: 'number', order: 2 },
  { name: 'discount', type: 'number', order: 3 },
  { name: 'status', type: 'string', order: 4, description: 'active|blocked|expired' },
  { name: 'washId', type: 'string', order: 5 },
  { name: 'postId', type: 'string', order: 6 },
];

const usageStatsFields: SchemaField[] = [
  { name: 'washId', type: 'string', required: true, order: 0 },
  { name: 'postId', type: 'string', order: 1 },
  { name: 'period', type: 'string', required: true, order: 2, description: 'before_collection|after_collection' },
  { name: 'category', type: 'string', required: true, order: 3, description: 'regular|unlimited|service' },
  { name: 'launchCount', type: 'number', order: 4 },
  { name: 'usageTime', type: 'number', order: 5, description: 'Секунды' },
  { name: 'avgWashTime', type: 'number', order: 6 },
  { name: 'clientCount', type: 'number', order: 7 },
  { name: 'recordedAt', type: 'datetime', order: 8 },
];

const financeStatsFields: SchemaField[] = [
  { name: 'washId', type: 'string', required: true, order: 0 },
  { name: 'postId', type: 'string', order: 1 },
  { name: 'period', type: 'string', required: true, order: 2, description: 'before_collection|after_collection' },
  { name: 'cash', type: 'number', order: 3 },
  { name: 'cashless', type: 'number', order: 4 },
  { name: 'discountOps', type: 'number', order: 5 },
  { name: 'totalRevenue', type: 'number', order: 6 },
  { name: 'avgCheck', type: 'number', order: 7 },
  { name: 'recordedAt', type: 'datetime', order: 8 },
];

const settingsFields: SchemaField[] = [
  { name: 'key', type: 'string', required: true, order: 0, description: 'backup|archive|telegram|notifications' },
  { name: 'value', type: 'json', required: true, order: 1 },
];

const notificationFields: SchemaField[] = [
  { name: 'type', type: 'string', required: true, order: 0, description: 'connection_lost|equipment_error|queue_overflow|backup_error' },
  { name: 'severity', type: 'string', order: 1, description: 'info|warning|error' },
  { name: 'washId', type: 'string', order: 2 },
  { name: 'postId', type: 'string', order: 3 },
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
  { name: 'details', type: 'json', order: 4 },
];

const telemetryFields: SchemaField[] = [
  { name: 'washSerial', type: 'string', order: 0 },
  { name: 'postSerial', type: 'string', order: 1 },
  { name: 'messageType', type: 'string', required: true, order: 2 },
  { name: 'payload', type: 'json', required: true, order: 3 },
  { name: 'receivedAt', type: 'datetime', order: 4 },
];

export const CRM_ENDPOINTS: EndpointDef[] = [
  { name: 'Список автомоек', slug: 'crm-washes-list', path: '/api/crm/washes', method: 'GET', schema: [], accessType: 'authenticated', groupKey: 'washes', description: 'Получить список автомоек' },
  { name: 'Создать автомойку', slug: 'crm-washes-create', path: '/api/crm/washes', method: 'POST', schema: washFields, accessType: 'group', groupKey: 'washes', description: 'Создать автомойку' },
  { name: 'Автомойка по ID', slug: 'crm-washes-get', path: '/api/crm/washes/:id', method: 'GET', schema: [], accessType: 'authenticated', groupKey: 'washes', description: 'Получить автомойку' },
  { name: 'Обновить автомойку', slug: 'crm-washes-update', path: '/api/crm/washes/:id', method: 'PUT', schema: washFields, accessType: 'group', groupKey: 'washes', description: 'Обновить автомойку' },
  { name: 'Удалить автомойку', slug: 'crm-washes-delete', path: '/api/crm/washes/:id', method: 'DELETE', schema: [], accessType: 'group', groupKey: 'washes', description: 'Удалить автомойку' },

  { name: 'Список постов', slug: 'crm-posts-list', path: '/api/crm/posts', method: 'GET', schema: [], accessType: 'authenticated', groupKey: 'posts', description: 'Получить список постов' },
  { name: 'Создать пост', slug: 'crm-posts-create', path: '/api/crm/posts', method: 'POST', schema: postFields, accessType: 'group', groupKey: 'posts', description: 'Создать пост' },
  { name: 'Пост по ID', slug: 'crm-posts-get', path: '/api/crm/posts/:id', method: 'GET', schema: [], accessType: 'authenticated', groupKey: 'posts', description: 'Получить пост' },
  { name: 'Обновить пост', slug: 'crm-posts-update', path: '/api/crm/posts/:id', method: 'PUT', schema: postFields, accessType: 'group', groupKey: 'posts', description: 'Обновить пост' },
  { name: 'Удалить пост', slug: 'crm-posts-delete', path: '/api/crm/posts/:id', method: 'DELETE', schema: [], accessType: 'group', groupKey: 'posts', description: 'Удалить пост' },

  { name: 'Состояние поста', slug: 'crm-post-states-list', path: '/api/crm/post-states', method: 'GET', schema: [], accessType: 'authenticated', groupKey: 'scada', description: 'Список состояний постов' },
  { name: 'Создать состояние', slug: 'crm-post-states-create', path: '/api/crm/post-states', method: 'POST', schema: postStateFields, accessType: 'group', groupKey: 'scada', description: 'Создать состояние поста' },
  { name: 'Состояние по ID', slug: 'crm-post-states-get', path: '/api/crm/post-states/:id', method: 'GET', schema: [], accessType: 'authenticated', groupKey: 'scada', description: 'Получить состояние' },
  { name: 'Обновить состояние', slug: 'crm-post-states-update', path: '/api/crm/post-states/:id', method: 'PUT', schema: postStateFields, accessType: 'group', groupKey: 'scada', description: 'Обновить состояние поста' },
  { name: 'Частичное обновление состояния', slug: 'crm-post-states-patch', path: '/api/crm/post-states/:id', method: 'PATCH', schema: postStateFields, accessType: 'group', groupKey: 'scada', description: 'Частичное обновление' },

  { name: 'Список карт', slug: 'crm-cards-list', path: '/api/crm/cards', method: 'GET', schema: [], accessType: 'authenticated', groupKey: 'cards', description: 'Список карт клиентов' },
  { name: 'Создать карту', slug: 'crm-cards-create', path: '/api/crm/cards', method: 'POST', schema: cardFields, accessType: 'group', groupKey: 'cards', description: 'Создать карту' },
  { name: 'Карта по ID', slug: 'crm-cards-get', path: '/api/crm/cards/:id', method: 'GET', schema: [], accessType: 'authenticated', groupKey: 'cards', description: 'Получить карту' },
  { name: 'Обновить карту', slug: 'crm-cards-update', path: '/api/crm/cards/:id', method: 'PUT', schema: cardFields, accessType: 'group', groupKey: 'cards', description: 'Обновить карту' },

  { name: 'Статистика использования', slug: 'crm-usage-stats-list', path: '/api/crm/usage-stats', method: 'GET', schema: [], accessType: 'authenticated', groupKey: 'statistics', description: 'Статистика использования' },
  { name: 'Записать статистику', slug: 'crm-usage-stats-create', path: '/api/crm/usage-stats', method: 'POST', schema: usageStatsFields, accessType: 'group', groupKey: 'statistics', description: 'Записать статистику' },

  { name: 'Финансовая статистика', slug: 'crm-finance-stats-list', path: '/api/crm/finance-stats', method: 'GET', schema: [], accessType: 'authenticated', groupKey: 'statistics', description: 'Финансовая статистика' },
  { name: 'Записать финансы', slug: 'crm-finance-stats-create', path: '/api/crm/finance-stats', method: 'POST', schema: financeStatsFields, accessType: 'group', groupKey: 'statistics', description: 'Записать финансы' },

  { name: 'Настройки CRM', slug: 'crm-settings-list', path: '/api/crm/settings', method: 'GET', schema: [], accessType: 'authenticated', groupKey: 'settings', description: 'Получить настройки' },
  { name: 'Сохранить настройки', slug: 'crm-settings-create', path: '/api/crm/settings', method: 'POST', schema: settingsFields, accessType: 'group', groupKey: 'settings', description: 'Сохранить настройки' },
  { name: 'Обновить настройки', slug: 'crm-settings-update', path: '/api/crm/settings/:id', method: 'PUT', schema: settingsFields, accessType: 'group', groupKey: 'settings', description: 'Обновить настройки' },

  { name: 'Уведомления', slug: 'crm-notifications-list', path: '/api/crm/notifications', method: 'GET', schema: [], accessType: 'authenticated', groupKey: 'notifications', description: 'Список уведомлений' },
  { name: 'Создать уведомление', slug: 'crm-notifications-create', path: '/api/crm/notifications', method: 'POST', schema: notificationFields, accessType: 'group', groupKey: 'notifications', description: 'Создать уведомление' },
  { name: 'Обновить уведомление', slug: 'crm-notifications-update', path: '/api/crm/notifications/:id', method: 'PATCH', schema: notificationFields, accessType: 'group', groupKey: 'notifications', description: 'Обновить уведомление' },

  { name: 'Резервные копии', slug: 'crm-backups-list', path: '/api/crm/backups', method: 'GET', schema: [], accessType: 'group', groupKey: 'backup', description: 'Список резервных копий' },
  { name: 'Создать запись бэкапа', slug: 'crm-backups-create', path: '/api/crm/backups', method: 'POST', schema: backupFields, accessType: 'group', groupKey: 'backup', description: 'Зарегистрировать бэкап' },
  { name: 'Обновить бэкап', slug: 'crm-backups-update', path: '/api/crm/backups/:id', method: 'PATCH', schema: backupFields, accessType: 'group', groupKey: 'backup', description: 'Обновить статус бэкапа' },

  { name: 'Журнал архивирования', slug: 'crm-archive-logs-list', path: '/api/crm/archive-logs', method: 'GET', schema: [], accessType: 'group', groupKey: 'backup', description: 'Журнал архивирования' },
  { name: 'Записать архивирование', slug: 'crm-archive-logs-create', path: '/api/crm/archive-logs', method: 'POST', schema: archiveLogFields, accessType: 'group', groupKey: 'backup', description: 'Записать операцию архива' },

  { name: 'Телеметрия (внутр.)', slug: 'crm-telemetry-create', path: '/api/crm/telemetry', method: 'POST', schema: telemetryFields, accessType: 'group', groupKey: 'telemetry', description: 'Приём телеметрии от processor' },
  { name: 'Список телеметрии', slug: 'crm-telemetry-list', path: '/api/crm/telemetry', method: 'GET', schema: [], accessType: 'group', groupKey: 'telemetry', description: 'Список телеметрии' },
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
    key: 'notifications',
    value: {
      telegram: true,
      web: true,
      events: {
        connectionLost: true,
        equipmentError: true,
        queueOverflow: true,
        backupError: true,
      },
    },
  },
];
