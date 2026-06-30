import { NavLink, Outlet, Link, useLocation } from 'react-router-dom';
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
  LogOut,
  Menu,
  X,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  Users,
  Shield,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { useAuth } from '../context/AuthContext';
import { ThemeToggle } from './ThemeToggle';
import { LiveModeProvider } from '../context/LiveModeContext';
import { LiveModeIndicator } from './LiveModeIndicator';
import { EmbeddedServicesSidebar } from './EmbeddedServicesSidebar';
import { breadcrumbsFromPath } from '../utils/breadcrumbs';

interface NavItem {
  to: string;
  label: string;
  shortLabel?: string;
  icon: LucideIcon;
  admin?: boolean;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    title: 'Главное',
    items: [{ to: '/', label: 'Обзор', icon: LayoutDashboard }],
  },
  {
    title: 'Объекты',
    items: [
      { to: '/washes', label: 'Автомойки', shortLabel: 'Мойки', icon: Building2 },
      { to: '/posts', label: 'Посты', icon: Columns3 },
      { to: '/states', label: 'Состояние', shortLabel: 'Состояние', icon: Activity },
    ],
  },
  {
    title: 'Карты',
    items: [
      { to: '/cards/discount', label: 'Скидочные', icon: CreditCard },
      { to: '/cards/service', label: 'Сервисные', icon: CreditCard },
      { to: '/cards/vip', label: 'VIP', icon: CreditCard },
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
    title: 'Система',
    items: [
      { to: '/notifications', label: 'Уведомления', icon: Bell },
      { to: '/users', label: 'Пользователи', icon: Users, admin: true },
      { to: '/groups', label: 'Группы и права', icon: Shield, admin: true },
      { to: '/backups', label: 'Резервные копии', shortLabel: 'Бэкапы', icon: HardDrive, admin: true },
      { to: '/telegram', label: 'Telegram', icon: Bot, admin: true },
      { to: '/currency', label: 'Валюты', icon: Coins, admin: true },
      { to: '/discount-types', label: 'Типы скидок', icon: Tags, admin: true },
      { to: '/settings', label: 'Настройки', icon: Settings },
      { to: '/logs', label: 'Логи', icon: FileText, admin: true },
    ],
  },
];

const SIDEBAR_KEY = 'wash_sidebar_collapsed';

function userInitials(name?: string, login?: string): string {
  const source = (name || login || '?').trim();
  const parts = source.split(/\s+/);
  if (parts.length >= 2) return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

export function Layout() {
  const { user, logout, isAdmin } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(SIDEBAR_KEY) === '1');

  useEffect(() => {
    localStorage.setItem(SIDEBAR_KEY, collapsed ? '1' : '0');
  }, [collapsed]);

  const filteredGroups = useMemo(
    () =>
      navGroups
        .map((group) => ({
          ...group,
          items: group.items.filter((item) => !item.admin || isAdmin),
        }))
        .filter((group) => group.items.length > 0),
    [isAdmin]
  );

  const crumbs = useMemo(() => breadcrumbsFromPath(location.pathname), [location.pathname]);
  const sidebarWidth = collapsed ? 'w-[4.5rem]' : 'w-64';
  const mainOffset = collapsed ? 'lg:ml-[4.5rem]' : 'lg:ml-64';

  return (
    <LiveModeProvider>
      <div className="flex h-screen overflow-hidden bg-panel-canvas dark:bg-panel-canvas-dark">
        <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-40 flex h-full flex-col border-r border-panel-border bg-panel-card text-panel-ink transition-all duration-300 ease-out dark:border-panel-sidebar-border dark:bg-panel-sidebar dark:text-slate-300',
          sidebarWidth,
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div
          className={clsx(
            'flex h-16 shrink-0 items-center border-b border-panel-border dark:border-panel-sidebar-border',
            collapsed ? 'justify-center px-2' : 'gap-3 px-4'
          )}
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-700 text-sm font-bold text-white shadow-glow">
            W
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-panel-ink dark:text-white">WASH PRO CRM</div>
              <div className="truncate text-[11px] text-panel-muted dark:text-slate-500">SCADA · Управление</div>
            </div>
          )}
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2 py-4">
          {filteredGroups.map((group) => (
            <div key={group.title} className="mb-5 last:mb-0">
              {!collapsed && (
                <div className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-panel-muted dark:text-slate-500">
                  {group.title}
                </div>
              )}
              <div className="space-y-0.5">
                {group.items.map(({ to, label, shortLabel, icon: Icon }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={to === '/'}
                    title={collapsed ? label : undefined}
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) =>
                      clsx('nav-item', isActive && 'nav-item-active', collapsed && 'justify-center px-2')
                    }
                  >
                    <Icon size={18} strokeWidth={1.75} className="shrink-0" />
                    {!collapsed && <span className="truncate">{shortLabel ?? label}</span>}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="shrink-0 space-y-2 border-t border-panel-border p-2 dark:border-panel-sidebar-border">
          <EmbeddedServicesSidebar collapsed={collapsed} />

          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            className={clsx('nav-item w-full', collapsed && 'justify-center px-2')}
            title={collapsed ? 'Развернуть меню' : 'Свернуть меню'}
          >
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            {!collapsed && <span>Свернуть меню</span>}
          </button>
        </div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <div className={clsx('flex min-h-0 min-w-0 flex-1 flex-col transition-all duration-300', mainOffset)}>
          <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-4 border-b border-panel-border bg-panel-card/90 px-4 backdrop-blur-md dark:border-panel-border-dark dark:bg-panel-card-dark/90 lg:px-6">
            <button
              type="button"
              className="btn-icon lg:hidden"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="Меню"
            >
              {mobileOpen ? <X size={18} /> : <Menu size={18} />}
            </button>

            <div className="flex min-w-0 shrink-0 items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600/15 text-xs font-semibold text-brand-700 ring-1 ring-brand-500/25 dark:bg-brand-400/15 dark:text-brand-300 dark:ring-brand-400/30">
                {userInitials(user?.name, user?.login)}
              </div>
              <div className="hidden min-w-0 sm:block">
                <div className="truncate text-sm font-medium text-panel-ink dark:text-panel-ink-dark">
                  {user?.name || user?.login}
                </div>
                <div className="truncate text-[11px] text-panel-muted dark:text-panel-muted-dark">
                  {isAdmin ? 'Администратор' : 'Оператор'}
                </div>
              </div>
            </div>

            <div className="flex-1" />

            <div className="flex items-center gap-2">
              <LiveModeIndicator />
              <Link to="/notifications" className="btn-icon relative" title="Уведомления">
                <Bell size={18} />
              </Link>
              <ThemeToggle />
              <button type="button" onClick={() => logout()} className="btn-icon text-red-500 hover:border-red-500/30 hover:text-red-500" title="Выход">
                <LogOut size={18} />
              </button>
            </div>
          </header>

          <main className="min-h-0 flex-1 overflow-auto">
            <div className="animate-slide-up mx-auto w-full max-w-[1600px] p-4 lg:p-8">
              <nav className="mb-4 flex min-w-0 flex-wrap items-center gap-1.5 text-sm" aria-label="Навигация">
                {crumbs.map((crumb, i) => (
                  <span key={`${crumb.label}-${i}`} className="flex min-w-0 items-center gap-1.5">
                    {i > 0 && <ChevronRight size={14} className="shrink-0 text-panel-muted" />}
                    {crumb.path ? (
                      <Link
                        to={crumb.path}
                        className="truncate text-panel-muted transition-colors hover:text-brand-600 dark:text-panel-muted-dark dark:hover:text-brand-400"
                      >
                        {crumb.label}
                      </Link>
                    ) : (
                      <span className="truncate font-medium text-panel-ink dark:text-panel-ink-dark">{crumb.label}</span>
                    )}
                  </span>
                ))}
              </nav>
              <div className="mb-6 h-px w-full bg-panel-border dark:bg-panel-border-dark" aria-hidden />
              <Outlet />
            </div>
          </main>
      </div>
    </div>
    </LiveModeProvider>
  );
}
