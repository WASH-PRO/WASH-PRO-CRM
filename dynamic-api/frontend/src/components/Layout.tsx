import { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Users, Shield, Globe, FileText,
  LogOut, Sun, Moon, Zap, Menu, X, Server, Folders, Settings,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useState } from 'react';

const navSections = [
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
    ],
  },
  {
    label: 'Administration',
    items: [
      { to: '/users', icon: Users, label: 'Users' },
      { to: '/groups', icon: Shield, label: 'User Groups' },
      { to: '/settings', icon: Settings, label: 'Settings' },
      { to: '/logs', icon: FileText, label: 'Logs' },
    ],
  },
];

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-dark-bg">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-sm tracking-tight">Dynamic API</h1>
            <p className="text-[10px] text-dark-muted">Platform v1.0</p>
          </div>
          <button className="ml-auto lg:hidden text-dark-muted hover:text-dark-text" onClick={() => setSidebarOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 py-3 px-3 overflow-y-auto">
          {navSections.map((section) => (
            <div key={section.label} className="mb-4">
              <p className="nav-section-label">{section.label}</p>
              <div className="space-y-0.5">
                {section.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <item.icon className="w-4 h-4 shrink-0" />
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="flex items-center gap-3 px-2 mb-3">
            <div className="user-avatar">
              {user?.name?.charAt(0) || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.name}</p>
              <p className="text-[10px] text-dark-muted truncate">{user?.login}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={toggleTheme} className="btn-secondary flex-1 justify-center py-1.5" title="Toggle theme">
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button onClick={logout} className="btn-secondary flex-1 justify-center py-1.5" title="Logout">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="mobile-header">
          <button onClick={() => setSidebarOpen(true)} className="text-dark-muted hover:text-dark-text">
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-bold text-sm">Dynamic API Platform</span>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-8 main-content">
          {children}
        </main>
      </div>
    </div>
  );
}
