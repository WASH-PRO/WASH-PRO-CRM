const ROUTE_LABELS: Record<string, string> = {
  '': 'Обзор',
  washes: 'Автомойки',
  posts: 'Посты',
  states: 'Текущее состояние',
  cards: 'Карты',
  discount: 'Скидочные',
  service: 'Сервисные',
  vip: 'VIP',
  usage: 'Статистика использования',
  finance: 'Финансовая статистика',
  archive: 'Архивирование',
  notifications: 'Уведомления',
  users: 'Пользователи',
  groups: 'Группы и права',
  backups: 'Резервные копии',
  telegram: 'Telegram',
  currency: 'Валюты',
  'discount-types': 'Типы скидок',
  settings: 'Настройки',
  logs: 'Логи',
};

export interface BreadcrumbItem {
  label: string;
  path?: string;
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
    const label = ROUTE_LABELS[segments[i]!] ?? segments[i]!;
    const isLast = i === segments.length - 1;
    items.push({ label, path: isLast ? undefined : acc });
  }

  return items;
}
