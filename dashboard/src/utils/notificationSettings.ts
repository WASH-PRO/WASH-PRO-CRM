import type { NotificationSettings } from '../types';

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
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
};

export const NOTIFICATION_EVENT_GROUPS: {
  title: string;
  items: { key: keyof NonNullable<NotificationSettings['events']>; label: string }[];
}[] = [
  {
    title: 'Система и сервисы',
    items: [
      { key: 'backupSuccess', label: 'Успешный бэкап' },
      { key: 'backupError', label: 'Ошибка бэкапа' },
      { key: 'archiveSuccess', label: 'Успешное архивирование' },
      { key: 'archiveError', label: 'Ошибка архивирования' },
      { key: 'autoTask', label: 'Автозадачи (бэкап, архив)' },
      { key: 'queueOverflow', label: 'Переполнение очереди MQTT' },
      { key: 'telegramBotCreated', label: 'Создан Telegram-бот' },
      { key: 'telegramBotError', label: 'Ошибка Telegram-бота' },
    ],
  },
  {
    title: 'Пользователи и безопасность',
    items: [
      { key: 'userLogin', label: 'Вход в систему' },
      { key: 'userLogout', label: 'Выход из системы' },
      { key: 'userPasswordChanged', label: 'Смена пароля' },
      { key: 'userCreated', label: 'Создание пользователя' },
      { key: 'userUpdated', label: 'Изменение пользователя' },
      { key: 'userDeleted', label: 'Удаление пользователя' },
    ],
  },
  {
    title: 'Справочники и объекты',
    items: [
      { key: 'washCreated', label: 'Создание автомойки' },
      { key: 'washUpdated', label: 'Изменение автомойки' },
      { key: 'washDeleted', label: 'Удаление автомойки' },
      { key: 'postCreated', label: 'Создание поста' },
      { key: 'postUpdated', label: 'Изменение поста' },
      { key: 'postDeleted', label: 'Удаление поста' },
      { key: 'settingsUpdated', label: 'Изменение настроек' },
      { key: 'currencyCreated', label: 'Создание валюты' },
      { key: 'currencyUpdated', label: 'Изменение валюты' },
      { key: 'currencyDeleted', label: 'Удаление валюты' },
      { key: 'discountTypeUpdated', label: 'Изменение типа скидки' },
      { key: 'workModeUpdated', label: 'Изменение режима работы' },
      { key: 'cardCreated', label: 'Создание карты' },
      { key: 'cardUpdated', label: 'Изменение карты' },
      { key: 'cardDeleted', label: 'Удаление карты' },
    ],
  },
  {
    title: 'Посты (телеметрия)',
    items: [
      { key: 'connectionLost', label: 'Потеря связи с постом' },
      { key: 'equipmentError', label: 'Ошибка оборудования' },
    ],
  },
];

export const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  connection_lost: 'Потеря связи',
  equipment_error: 'Ошибка оборудования',
  queue_overflow: 'Переполнение очереди',
  backup_success: 'Бэкап выполнен',
  backup_error: 'Ошибка бэкапа',
  archive_success: 'Архивирование',
  archive_error: 'Ошибка архива',
  telegram_bot_created: 'Telegram-бот создан',
  telegram_bot_error: 'Ошибка Telegram-бота',
  user_login: 'Вход',
  user_logout: 'Выход',
  user_password_changed: 'Смена пароля',
  user_created: 'Пользователь создан',
  user_updated: 'Пользователь изменён',
  user_deleted: 'Пользователь удалён',
  wash_created: 'Автомойка создана',
  wash_updated: 'Автомойка изменена',
  wash_deleted: 'Автомойка удалена',
  post_created: 'Пост создан',
  post_updated: 'Пост изменён',
  post_deleted: 'Пост удалён',
  settings_updated: 'Настройки изменены',
  currency_created: 'Валюта создана',
  currency_updated: 'Валюта изменена',
  currency_deleted: 'Валюта удалена',
  discount_type_updated: 'Тип скидки изменён',
  work_mode_updated: 'Режим работы изменён',
  card_created: 'Карта создана',
  card_updated: 'Карта изменена',
  card_deleted: 'Карта удалена',
  mqtt_credit: 'Зачисление на пост',
  mqtt_collection: 'Инкассация',
  auto_backup: 'Автобэкап',
  auto_archive: 'Автоархив',
};

export function parseNotificationSettings(raw: Record<string, unknown>): NotificationSettings {
  const events = (raw.events as Record<string, unknown>) ?? {};
  const merged = { ...DEFAULT_NOTIFICATION_SETTINGS.events };
  for (const key of Object.keys(merged) as (keyof typeof merged)[]) {
    if (events[key] !== undefined) merged[key] = events[key] !== false;
  }
  return {
    telegram: raw.telegram !== false,
    web: raw.web !== false,
    events: merged,
  };
}
