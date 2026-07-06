import { NavLink, Outlet, Link, useLocation } from 'react-router-dom';
import {
  Bell,
  LogOut,
  Menu,
  X,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { useMemo, useState, type CSSProperties } from 'react';
import clsx from 'clsx';
import { useAuth } from '../context/AuthContext';
import { useSidebarSize } from '../hooks/useSidebarSize';
import { ThemeToggle } from './ThemeToggle';
import { LiveModeProvider } from '../context/LiveModeContext';
import { LiveModeIndicator } from './LiveModeIndicator';
import { EmbeddedServicesSidebar } from './EmbeddedServicesSidebar';
import { breadcrumbsFromPath } from '../utils/breadcrumbs';
import { navGroups } from '../utils/navRoutes';
import { BreadcrumbProvider, useBreadcrumbLastLabelOverride } from '../context/BreadcrumbContext';
import { BrandLogo } from './BrandLogo';

function LayoutInner() {
  const { user, logout, isAdmin } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const sidebarUserKey = user?.id || user?.login;
  const { collapsed, setCollapsed, effectiveWidth, resizing, startResize, canResize } =
    useSidebarSize(sidebarUserKey);

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

  const lastCrumbLabel = useBreadcrumbLastLabelOverride();
  const crumbs = useMemo(() => {
    const items = breadcrumbsFromPath(location.pathname);
    if (!lastCrumbLabel || items.length === 0) return items;
    return items.map((item, i) =>
      i === items.length - 1 ? { ...item, label: lastCrumbLabel } : item
    );
  }, [location.pathname, lastCrumbLabel]);

  return (
      <div
        className="flex h-screen overflow-hidden bg-panel-canvas dark:bg-panel-canvas-dark"
        style={{ '--sidebar-width': `${effectiveWidth}px` } as CSSProperties}
      >
        <aside
        style={{ '--drawer-width': `${effectiveWidth}px` } as CSSProperties}
        className={clsx(
          'fixed inset-y-0 left-0 z-40 flex h-full w-[min(calc(100vw-1rem),var(--drawer-width))] flex-col border-r border-panel-border bg-panel-card text-panel-ink dark:border-panel-sidebar-border dark:bg-panel-sidebar dark:text-slate-300 lg:w-[var(--drawer-width)]',
          !resizing && 'transition-[width,transform] duration-300 ease-out',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div
          className={clsx(
            'flex h-16 shrink-0 items-center border-b border-panel-border dark:border-panel-sidebar-border',
            collapsed ? 'justify-center px-2' : 'gap-3 px-4'
          )}
        >
          <BrandLogo size="md" className={collapsed ? '' : undefined} />
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
          <EmbeddedServicesSidebar collapsed={collapsed} onNavigate={() => setMobileOpen(false)} />

          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            className={clsx('nav-item hidden w-full lg:flex', collapsed && 'justify-center px-2')}
            title={collapsed ? 'Развернуть меню' : 'Свернуть меню'}
          >
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            {!collapsed && <span>Свернуть меню</span>}
          </button>
        </div>

        {canResize && (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Изменить ширину меню"
            onMouseDown={startResize}
            className={clsx(
              'absolute inset-y-0 right-0 z-50 hidden w-1.5 translate-x-1/2 cursor-col-resize touch-none lg:block',
              'hover:bg-brand-500/35 active:bg-brand-500/50',
              resizing && 'bg-brand-500/50'
            )}
          />
        )}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <div
        className={clsx(
          'flex min-h-0 min-w-0 flex-1 flex-col lg:ml-[var(--sidebar-width)]',
          !resizing && 'transition-[margin-left] duration-300 ease-out'
        )}
      >
          <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b border-panel-border bg-panel-card/90 px-3 backdrop-blur-md dark:border-panel-border-dark dark:bg-panel-card-dark/90 sm:h-16 sm:gap-4 sm:px-4 lg:px-6">
            <button
              type="button"
              className="btn-icon lg:hidden"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="Меню"
            >
              {mobileOpen ? <X size={18} /> : <Menu size={18} />}
            </button>

            <Link
              to="/profile"
              className="flex min-w-0 shrink-0 items-center gap-3 rounded-lg transition-colors hover:bg-panel-canvas/80 dark:hover:bg-white/[0.04]"
              title="Мой профиль"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-brand-500/35 bg-transparent text-xs font-semibold text-brand-700 dark:border-brand-400/40 dark:text-brand-300">
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
            </Link>

            <div className="flex-1" />

            <div className="flex shrink-0 items-center gap-1 sm:gap-2">
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
            <div className="animate-slide-up mx-auto w-full max-w-[1600px] p-3 sm:p-4 lg:p-8">
              <nav className="mb-3 flex min-w-0 flex-wrap items-center gap-1.5 text-xs sm:mb-4 sm:text-sm" aria-label="Навигация">
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
              <Outlet />
            </div>
          </main>
      </div>
      </div>
  );
}

function userInitials(name?: string, login?: string): string {
  const source = (name || login || '?').trim();
  const parts = source.split(/\s+/);
  if (parts.length >= 2) return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

export function Layout() {
  return (
    <LiveModeProvider>
      <BreadcrumbProvider>
        <LayoutInner />
      </BreadcrumbProvider>
    </LiveModeProvider>
  );
}
