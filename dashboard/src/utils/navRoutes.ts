import {
  LayoutDashboard,
  Building2,
  Columns3,
  Activity,
  Server,
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
  Blocks,
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

type TranslateFn = (key: string, params?: Record<string, string | number>) => string;

export function getNavGroups(t: TranslateFn): NavGroup[] {
  return [
    {
      title: t('nav.groups.main'),
      items: [
        { to: '/', label: t('nav.items.dashboard'), icon: LayoutDashboard },
        { to: '/states', label: t('nav.items.states'), shortLabel: t('nav.short.states'), icon: Activity },
      ],
    },
    {
      title: t('nav.groups.objects'),
      items: [
        { to: '/washes', label: t('nav.items.washes'), shortLabel: t('nav.short.washes'), icon: Building2 },
        { to: '/posts', label: t('nav.items.posts'), icon: Columns3 },
      ],
    },
    {
      title: t('nav.groups.data'),
      items: [{ to: '/mqtt', label: t('nav.items.mqtt'), icon: Radio }],
    },
    {
      title: t('nav.groups.cards'),
      items: [
        { to: '/cards/discount', label: t('nav.items.cardsDiscount'), icon: CreditCard },
        { to: '/cards/service', label: t('nav.items.cardsService'), icon: CreditCard },
        { to: '/cards/vip', label: t('nav.items.cardsVip'), icon: CreditCard },
        { to: '/cards/collection', label: t('nav.items.cardsCollection'), icon: CreditCard },
      ],
    },
    {
      title: t('nav.groups.analytics'),
      items: [
        { to: '/usage', label: t('nav.items.usage'), shortLabel: t('nav.short.usage'), icon: BarChart3 },
        { to: '/finance', label: t('nav.items.finance'), icon: Wallet },
        { to: '/archive', label: t('nav.items.archive'), icon: Archive },
      ],
    },
    {
      title: t('nav.groups.references'),
      items: [
        { to: '/work-modes', label: t('nav.items.workModes'), shortLabel: t('nav.short.workModes'), icon: SlidersHorizontal, admin: true },
        { to: '/currency', label: t('nav.items.currency'), icon: Coins, admin: true },
        { to: '/discount-types', label: t('nav.items.discountTypes'), icon: Tags, admin: true },
      ],
    },
    {
      title: t('nav.groups.automation'),
      items: [
        { to: '/info-messages', label: t('nav.items.infoMessages'), icon: Newspaper, admin: true },
        { to: '/telegram', label: t('nav.items.telegram'), icon: Bot, admin: true },
        { to: '/mcp', label: t('nav.items.mcp'), shortLabel: t('nav.short.mcp'), icon: Cpu, admin: true },
        { to: '/modules', label: t('nav.items.modules'), icon: Blocks, admin: true },
        { to: '/backups', label: t('nav.items.backups'), shortLabel: t('nav.short.backups'), icon: HardDrive, admin: true },
      ],
    },
    {
      title: t('nav.groups.system'),
      items: [
        { to: '/system', label: t('nav.items.system'), shortLabel: t('nav.short.system'), icon: Server },
        { to: '/notifications', label: t('nav.items.notifications'), icon: Bell },
        { to: '/users', label: t('nav.items.users'), icon: Users, admin: true },
        { to: '/groups', label: t('nav.items.groups'), icon: Shield, admin: true },
        { to: '/settings', label: t('nav.items.settings'), icon: Settings },
        { to: '/logs', label: t('nav.items.logs'), icon: FileText, admin: true },
      ],
    },
  ];
}

const navItemsByPathLength = getNavGroups((k) => k)
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
