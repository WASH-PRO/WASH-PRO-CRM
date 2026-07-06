import clsx from 'clsx';
import { BookOpen, Cpu, Github, Menu, Workflow } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { useEmbeddedServices, type EmbeddedService, type ServiceStatus } from '../hooks/useEmbeddedServices';

const DOC_LINKS = [
  { href: 'https://wash-pro.github.io/WASH-PRO-CRM/', label: 'Документация', icon: BookOpen },
  { href: 'https://github.com/WASH-PRO/WASH-PRO-CRM', label: 'GitHub', icon: Github },
] as const;

const SERVICE_ICONS: Record<string, LucideIcon> = {
  'dynamic-api': Workflow,
  pyorchestrator: Cpu,
};

function statusDot(status: ServiceStatus): string {
  switch (status) {
    case 'online':
      return 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.55)]';
    case 'offline':
      return 'bg-slate-400 dark:bg-slate-600';
    default:
      return 'bg-amber-400 animate-pulse';
  }
}

function statusLabel(status: ServiceStatus): string {
  switch (status) {
    case 'online':
      return 'Запущен';
    case 'offline':
      return 'Остановлен';
    default:
      return 'Проверка…';
  }
}

interface EmbeddedServicesSidebarProps {
  collapsed: boolean;
  onNavigate?: () => void;
}

function ServiceRow({
  service,
  collapsed,
  onNavigate,
}: {
  service: EmbeddedService;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const Icon = SERVICE_ICONS[service.id] ?? Workflow;
  const online = service.status === 'online';

  return (
    <a
      href={service.panelUrl}
      target="_blank"
      rel="noopener noreferrer"
      title={`${service.label} — ${statusLabel(service.status)}`}
      onClick={onNavigate}
      className={clsx(
        'nav-item group',
        collapsed && 'justify-center px-2',
        !online && 'opacity-70'
      )}
    >
      <span className="relative shrink-0">
        <Icon size={18} strokeWidth={1.75} />
        {collapsed && (
          <span
            className={clsx(
              'absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full ring-2 ring-panel-card dark:ring-panel-sidebar',
              statusDot(service.status)
            )}
            aria-hidden
          />
        )}
      </span>
      {!collapsed && (
        <>
          <span className="min-w-0 flex-1 truncate">{service.label}</span>
          <span className="flex shrink-0 items-center gap-1.5">
            <span className={clsx('h-1.5 w-1.5 rounded-full', statusDot(service.status))} aria-hidden />
            <span className="text-[10px] text-panel-muted dark:text-slate-500">{statusLabel(service.status)}</span>
          </span>
        </>
      )}
    </a>
  );
}

export function EmbeddedServicesSidebar({ collapsed, onNavigate }: EmbeddedServicesSidebarProps) {
  const [open, setOpen] = useState(false);
  const services = useEmbeddedServices();

  const toggle = () => setOpen((v) => !v);

  return (
    <div className="space-y-0.5">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls="sidebar-resources-panel"
        title="Ресурсы"
        className={clsx(
          'nav-item w-full',
          collapsed && 'justify-center px-2',
          open && !collapsed && 'nav-item-active'
        )}
      >
        <Menu size={18} strokeWidth={1.75} className="shrink-0" />
        {!collapsed && <span className="truncate">Ресурсы</span>}
      </button>

      {open && (
        <div id="sidebar-resources-panel" className="space-y-0.5">
          {services.map((service) => (
            <ServiceRow
              key={service.id}
              service={service}
              collapsed={collapsed}
              onNavigate={onNavigate}
            />
          ))}
          {!collapsed && (
            <div className="mx-2 my-1 border-t border-panel-border dark:border-panel-sidebar-border" aria-hidden />
          )}
          {DOC_LINKS.map(({ href, label, icon: Icon }) => (
            <a
              key={href}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              title={collapsed ? label : undefined}
              onClick={onNavigate}
              className={clsx('nav-item opacity-80', collapsed && 'justify-center px-2')}
            >
              <Icon size={18} strokeWidth={1.75} className="shrink-0" />
              {!collapsed && <span className="truncate">{label}</span>}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
