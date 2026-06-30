import { useEffect, useState, ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Users, Shield, Globe, FileText,
  LogOut, Zap, Menu, X, Server, Folders, Settings,
  BookOpen, Github, Network, Database, FileCode, Clock, Webhook, Key, Bot, Palette,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { LiveModeProvider } from '../context/LiveModeContext';
import { getThemeOption } from '../themes';
import { userHasPermission } from '../utils/permissions';
import UpdateBanner from './UpdateBanner';
import { LiveModeIndicator } from './LiveModeIndicator';
import { StaticDataRegistrar } from './StaticDataRegistrar';

type NavItem = {
  to: string;
  icon: typeof LayoutDashboard;
  label: string;
  permission?: string;
};

const adminItems: NavItem[] = [
  { to: '/users', icon: Users, label: 'Users' },
  { to: '/groups', icon: Shield, label: 'User Groups' },
  { to: '/settings', icon: Settings, label: 'Settings' },
  { to: '/logs', icon: FileText, label: 'Logs' },
  { to: '/database', icon: Database, label: 'Database', permission: 'manage_users' },
];

const navSections: { label: string; items: NavItem[] }[] = [
  {
    label: 'Overview',
    items: [
      { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/system', icon: Server, label: 'System' },
    ],
  },
  {
    label: 'API',
    items: [
      { to: '/endpoints', icon: Globe, label: 'Endpoints' },
      { to: '/endpoint-groups', icon: Folders, label: 'Endpoint Groups' },
      { to: '/api-schema', icon: Network, label: 'API Schema' },
      { to: '/api-docs', icon: FileCode, label: 'API Docs' },
    ],
  },
  {
    label: 'Automation',
    items: [
      { to: '/cron', icon: Clock, label: 'Cron Jobs', permission: 'manage_api' },
      { to: '/webhooks', icon: Webhook, label: 'Webhooks', permission: 'manage_api' },
      { to: '/api-keys', icon: Key, label: 'API Keys', permission: 'manage_api' },
      { to: '/mcp', icon: Bot, label: 'MCP Server', permission: 'manage_api' },
    ],
  },
  {
    label: 'Administration',
    items: adminItems,
  },
];

const DOCS_URL = 'https://dynamic-api-platform.github.io/Dynamic-API-Platform/';
const GITHUB_URL = 'https://github.com/Dynamic-API-Platform';

function externalLinkClass() {
  return 'flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200';
}

function navClass(isActive: boolean) {
  return [
    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
    isActive
      ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300'
      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800',
  ].join(' ');
}

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const { theme, cycleTheme } = useTheme();
  const themeLabel = getThemeOption(theme)?.label ?? theme;
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [appVersion, setAppVersion] = useState('');

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then((d: { version?: string }) => {
        if (d.version) setAppVersion(d.version);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
      <aside
        className={[
          'fixed inset-y-0 left-0 z-40 flex h-screen w-64 shrink-0 flex-col border-r border-slate-200 bg-white transition-transform dark:border-slate-800 dark:bg-slate-900 lg:static lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        <div className="flex h-16 shrink-0 items-center gap-3 border-b border-slate-200 px-5 dark:border-slate-800">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white shadow-sm">
            <Zap className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">Dynamic API</div>
            <div className="text-xs text-slate-500">
              Platform {appVersion ? `v${appVersion}` : '…'}
            </div>
          </div>
          <button
            type="button"
            className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
          {navSections.map((section) => (
            <div key={section.label} className="mb-4 last:mb-0">
              <div className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {section.label}
              </div>
              <div className="space-y-0.5">
                {section.items
                  .filter((item) => !item.permission || userHasPermission(user, item.permission))
                  .map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    className={({ isActive }) => navClass(isActive)}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="shrink-0 border-t border-slate-200 p-3 dark:border-slate-800">
          <div className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Resources
          </div>
          <div className="space-y-0.5">
            <a
              href={DOCS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={externalLinkClass()}
            >
              <BookOpen className="h-4 w-4 shrink-0" />
              Documentation
            </a>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={externalLinkClass()}
            >
              <Github className="h-4 w-4 shrink-0" />
              GitHub
            </a>
          </div>
        </div>
      </aside>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <LiveModeProvider>
        <StaticDataRegistrar />
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-900 lg:px-6">
          <button
            type="button"
            className="text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="flex min-w-0 flex-1 items-center gap-3">
            <LiveModeIndicator />
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <div className="text-sm font-medium text-slate-800 dark:text-slate-100">{user?.name}</div>
              <div className="text-xs text-slate-500">{user?.login}</div>
            </div>
            <button
              type="button"
              onClick={cycleTheme}
              className="btn-secondary !px-2.5 !py-2"
              title={`Theme: ${themeLabel} — click to switch`}
            >
              <Palette className="h-4 w-4" />
            </button>
            <button type="button" onClick={logout} className="btn-secondary !px-2.5 !py-2" title="Logout">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-auto p-4 lg:p-6">
          <UpdateBanner />
          {children}
        </main>
        </LiveModeProvider>
      </div>
    </div>
  );
}
