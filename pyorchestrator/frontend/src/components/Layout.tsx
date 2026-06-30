import ThemeToggle from "@/components/ui/ThemeToggle";
import UpdateBanner from "@/components/UpdateBanner";
import { IconButton } from "@/components/ui/Button";
import { useAuth } from "@/context/AuthContext";
import { useTranslation } from "@/context/LocaleContext";
import { cn } from "@/lib/cn";
import {
  ArrowRightOnRectangleIcon,
  BellAlertIcon,
  ChartBarSquareIcon,
  ClockIcon,
  CloudArrowUpIcon,
  CodeBracketSquareIcon,
  CommandLineIcon,
  Cog6ToothIcon,
  FolderIcon,
  LinkIcon,
  ServerStackIcon,
  UsersIcon,
} from "@heroicons/react/24/outline";
import type { ComponentType, ReactNode } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";

interface NavItem {
  path: string;
  labelKey: string;
  icon: ComponentType<{ className?: string }>;
}

interface NavSection {
  titleKey: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    titleKey: "nav.sections.overview",
    items: [{ path: "/", labelKey: "nav.overview", icon: ChartBarSquareIcon }],
  },
  {
    titleKey: "nav.sections.automation",
    items: [
      { path: "/scripts", labelKey: "nav.scripts", icon: CodeBracketSquareIcon },
      { path: "/groups", labelKey: "nav.groups", icon: FolderIcon },
      { path: "/schedules", labelKey: "nav.schedules", icon: ClockIcon },
      { path: "/webhooks", labelKey: "nav.webhooks", icon: LinkIcon },
    ],
  },
  {
    titleKey: "nav.sections.operations",
    items: [
      { path: "/notifications", labelKey: "nav.alerts", icon: BellAlertIcon },
      { path: "/backups", labelKey: "nav.backups", icon: CloudArrowUpIcon },
    ],
  },
  {
    titleKey: "nav.sections.system",
    items: [
      { path: "/system", labelKey: "nav.system", icon: ServerStackIcon },
      { path: "/mcp", labelKey: "nav.mcp", icon: CommandLineIcon },
      { path: "/users", labelKey: "nav.users", icon: UsersIcon },
      { path: "/settings", labelKey: "nav.settings", icon: Cog6ToothIcon },
    ],
  },
];

function NavLink({ item, active, label }: { item: NavItem; active: boolean; label: string }) {
  const Icon = item.icon;
  return (
    <Link
      to={item.path}
      className={cn(
        "group flex items-center gap-x-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-cyan-400/10 text-cyan-400 ring-1 ring-inset ring-cyan-400/20"
          : "text-muted hover:bg-hover hover:text-foreground-secondary",
      )}
    >
      <Icon
        className={cn("size-5 shrink-0", active ? "text-cyan-400" : "text-faint group-hover:text-foreground-secondary")}
      />
      {label}
    </Link>
  );
}

function NavSectionBlock({
  title,
  children,
  first,
}: {
  title: string;
  children: ReactNode;
  first?: boolean;
}) {
  return (
    <div className={cn("space-y-1", !first && "mt-5 border-t border-line pt-5")}>
      <p className="px-3 pb-1 text-[0.6875rem] font-semibold uppercase tracking-wider text-faint">{title}</p>
      {children}
    </div>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const location = useLocation();

  const isActive = (path: string) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  return (
    <div className="flex min-h-screen w-full">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-line bg-surface lg:flex">
        <div className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-line px-5">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold tracking-tight text-foreground">PyOrchestrator</p>
            <p className="truncate text-xs text-faint">{t("layout.controlPlane")}</p>
          </div>
          <ThemeToggle />
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {navSections.map((section, index) => {
            const items = section.items.filter(
              (item) => item.path !== "/users" || user?.role === "Administrator",
            );
            if (items.length === 0) return null;
            return (
              <NavSectionBlock key={section.titleKey} title={t(section.titleKey)} first={index === 0}>
                {items.map((item) => (
                  <NavLink key={item.path} item={item} active={isActive(item.path)} label={t(item.labelKey)} />
                ))}
              </NavSectionBlock>
            );
          })}
        </nav>

        <div className="shrink-0 border-t border-line p-3">
          <div className="rounded-lg bg-input p-3 ring-1 ring-ring-line">
            <div className="flex items-center gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-chip text-xs font-semibold text-cyan-400">
                {user?.display_name?.[0] ?? "U"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground-secondary">{user?.display_name}</p>
                <p className="truncate text-xs text-faint">{user?.role}</p>
              </div>
              <IconButton
                onClick={logout}
                aria-label={t("common.signOut")}
                className="shrink-0 hover:bg-red-500/10 hover:text-red-400"
              >
                <ArrowRightOnRectangleIcon className="size-5" />
              </IconButton>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top nav */}
        <header className="sticky top-0 z-20 border-b border-line bg-overlay backdrop-blur-xl lg:hidden">
          <div className="flex h-14 items-center justify-between gap-3 px-4">
            <div className="flex items-center gap-3">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-cyan-400 text-[0.625rem] font-extrabold text-on-accent">
                PO
              </div>
              <p className="text-sm font-bold text-foreground">PyOrchestrator</p>
            </div>
            <ThemeToggle />
          </div>
          <nav className="flex items-center gap-2 overflow-x-auto px-3 pb-3">
            {navSections.map((section, sectionIndex) => {
              const items = section.items.filter(
                (item) => item.path !== "/users" || user?.role === "Administrator",
              );
              if (items.length === 0) return null;
              return (
                <div key={section.titleKey} className="flex shrink-0 items-center gap-2">
                  {sectionIndex > 0 && <span className="h-4 w-px shrink-0 bg-line-strong" aria-hidden />}
                  {items.map((item) => (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={cn(
                        "shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                        isActive(item.path)
                          ? "bg-cyan-400/10 text-cyan-400 ring-1 ring-inset ring-cyan-400/20"
                          : "text-faint hover:text-foreground-secondary",
                      )}
                    >
                      {t(item.labelKey)}
                    </Link>
                  ))}
                </div>
              );
            })}
          </nav>
        </header>

        <main className="animate-in flex min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto">
          <UpdateBanner />
          <Outlet />
        </main>
      </div>
    </div>
  );
}
