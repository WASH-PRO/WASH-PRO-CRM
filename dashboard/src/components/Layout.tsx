import { NavLink, Outlet } from 'react-router-dom';
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
  FileText,
  LogOut,
  Moon,
  Sun,
  Menu,
  X,
} from 'lucide-react';
import { useState } from 'react';
import clsx from 'clsx';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const navItems = [
  { to: '/', label: 'Обзор', icon: LayoutDashboard },
  { to: '/washes', label: 'Автомойки', icon: Building2 },
  { to: '/posts', label: 'Посты', icon: Columns3 },
  { to: '/states', label: 'Состояние', icon: Activity },
  { to: '/cards', label: 'Карты', icon: CreditCard },
  { to: '/usage', label: 'Статистика', icon: BarChart3 },
  { to: '/finance', label: 'Финансы', icon: Wallet },
  { to: '/archive', label: 'Архив', icon: Archive },
  { to: '/backups', label: 'Резервные копии', icon: HardDrive, admin: true },
  { to: '/telegram', label: 'Telegram', icon: Bot, admin: true },
  { to: '/notifications', label: 'Уведомления', icon: Bell },
  { to: '/logs', label: 'Логи', icon: FileText, admin: true },
];

export function Layout() {
  const { user, logout, isAdmin } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);

  const filteredNav = navItems.filter((item) => !item.admin || isAdmin);

  return (
    <div className="flex min-h-screen">
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-40 w-64 border-r border-slate-200 bg-white transition-transform dark:border-slate-800 dark:bg-slate-900 lg:static lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-16 items-center gap-2 border-b border-slate-200 px-5 dark:border-slate-800">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white font-bold">W</div>
          <div>
            <div className="font-semibold">WASH PHO CRM</div>
            <div className="text-xs text-slate-500">SCADA система</div>
          </div>
        </div>
        <nav className="space-y-1 p-3">
          {filteredNav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                )
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-900 lg:px-6">
          <button className="lg:hidden" onClick={() => setMobileOpen((v) => !v)}>
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
          <div className="text-sm text-slate-500">
            {user?.name || user?.login}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={toggleTheme} className="btn-secondary !px-2" title="Тема">
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button onClick={() => logout()} className="btn-secondary !px-2" title="Выход">
              <LogOut size={18} />
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
