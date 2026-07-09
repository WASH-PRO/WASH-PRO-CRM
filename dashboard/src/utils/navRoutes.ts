import {
  LayoutDashboard,
  Building2,
  Columns3,
  Activity,
  CreditCard,
  BarChart3,
  Wallet,
  Archive,
  HardDrive,
  Bot,
  Bell,
  Coins,
  Tags,
  FileText,
  Users,
  Shield,
  UserCircle,
  Radio,
  Settings,
  SlidersHorizontal,
  Newspaper,
  Cpu,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  shortLabel?: string;
  icon: LucideIcon;
  admin?: boolean;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export const navGroups: NavGroup[] = [
  {
    title: 'Главное',
    items: [
      { to: '/', label: 'Обзор', icon: LayoutDashboard },
      { to: '/states', label: 'Состояние', shortLabel: 'Состояние', icon: Activity },
    ],
  },
  {
    title: 'Объекты',
    items: [
      { to: '/washes', label: 'Автомойки', shortLabel: 'Мойки', icon: Building2 },
      { to: '/posts', label: 'Посты', icon: Columns3 },
    ],
  },
  {
    title: 'Данные',
    items: [{ to: '/mqtt', label: 'MQTT', icon: Radio }],
  },
  {
    title: 'Карты',
    items: [
      { to: '/cards/discount', label: 'Скидочные', icon: CreditCard },
      { to: '/cards/service', label: 'Сервисные', icon: CreditCard },
      { to: '/cards/vip', label: 'VIP', icon: CreditCard },
      { to: '/cards/collection', label: 'Инкассация', icon: CreditCard },
    ],
  },
  {
    title: 'Аналитика',
    items: [
      { to: '/usage', label: 'Использование', shortLabel: 'Usage', icon: BarChart3 },
      { to: '/finance', label: 'Финансы', icon: Wallet },
      { to: '/archive', label: 'Архив', icon: Archive },
    ],
  },
  {
    title: 'Справочники',
    items: [
      { to: '/work-modes', label: 'Режимы работы', shortLabel: 'Режимы', icon: SlidersHorizontal, admin: true },
      { to: '/currency', label: 'Валюты', icon: Coins, admin: true },
      { to: '/discount-types', label: 'Типы скидок', icon: Tags, admin: true },
    ],
  },
  {
    title: 'Автоматизация',
    items: [
      { to: '/info-messages', label: 'Информация', icon: Newspaper, admin: true },
      { to: '/telegram', label: 'Telegram', icon: Bot, admin: true },
      { to: '/mcp', label: 'MCP сервер', shortLabel: 'MCP', icon: Cpu, admin: true },
      { to: '/backups', label: 'Резервные копии', shortLabel: 'Бэкапы', icon: HardDrive, admin: true },
    ],
  },
  {
    title: 'Система',
    items: [
      { to: '/notifications', label: 'Уведомления', icon: Bell },
      { to: '/users', label: 'Пользователи', icon: Users, admin: true },
      { to: '/groups', label: 'Группы и права', icon: Shield, admin: true },
      { to: '/settings', label: 'Настройки', icon: Settings },
      { to: '/logs', label: 'Логи', icon: FileText, admin: true },
    ],
  },
];

const navItemsByPathLength = navGroups
  .flatMap((group) => group.items)
  .sort((a, b) => b.to.length - a.to.length);

export function resolveRouteIcon(pathname: string): LucideIcon {
  if (pathname === '/') return LayoutDashboard;
  if (pathname === '/profile' || pathname.startsWith('/profile/')) return UserCircle;

  for (const item of navItemsByPathLength) {
    if (item.to === '/') continue;
    if (pathname === item.to || pathname.startsWith(`${item.to}/`)) {
      return item.icon;
    }
  }

  return LayoutDashboard;
}
