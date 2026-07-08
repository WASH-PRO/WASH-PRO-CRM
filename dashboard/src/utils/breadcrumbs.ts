const ROUTE_LABELS: Record<string, string> = {
  '': 'Обзор',
  washes: 'Автомойки',
  posts: 'Посты',
  states: 'Текущее состояние',
  mqtt: 'MQTT',
  cards: 'Карты',
  discount: 'Скидочные',
  service: 'Сервисные',
  vip: 'VIP',
  collection: 'Инкассация',
  usage: 'Статистика использования',
  finance: 'Финансовая статистика',
  archive: 'Архивирование',
  notifications: 'Уведомления',
  users: 'Пользователи',
  groups: 'Группы и права',
  backups: 'Резервные копии',
  telegram: 'Telegram',
  'info-messages': 'Информация',
  currency: 'Валюты',
  'discount-types': 'Типы скидок',
  'work-modes': 'Режимы работы',
  settings: 'Настройки',
  profile: 'Мой профиль',
  logs: 'Логи',
};

export interface BreadcrumbItem {
  label: string;
  path?: string;
}

const OBJECT_ID_RE = /^[a-f0-9]{24}$/i;

function segmentLabel(segment: string, prevSegment?: string): string {
  if (prevSegment === 'posts' && OBJECT_ID_RE.test(segment)) {
    return 'Пост';
  }
  return ROUTE_LABELS[segment] ?? segment;
}

export function breadcrumbsFromPath(pathname: string): BreadcrumbItem[] {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) {
    return [{ label: 'Обзор' }];
  }

  const items: BreadcrumbItem[] = [{ label: 'Обзор', path: '/' }];
  let acc = '';

  for (let i = 0; i < segments.length; i++) {
    acc += `/${segments[i]}`;
    const label = segmentLabel(segments[i]!, segments[i - 1]);
    const isLast = i === segments.length - 1;
    items.push({ label, path: isLast ? undefined : acc });
  }

  return items;
}
