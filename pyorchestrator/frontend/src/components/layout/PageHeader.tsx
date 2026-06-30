import Badge from "@/components/ui/Badge";
import RefreshModeControl from "@/components/ui/RefreshModeControl";
import { useTranslation } from "@/context/LocaleContext";
import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  sticky?: boolean;
  className?: string;
  showRefresh?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
  lastUpdated?: Date | null;
}

export default function PageHeader({
  title,
  subtitle,
  action,
  sticky = true,
  className,
  showRefresh = true,
  onRefresh,
  refreshing,
  lastUpdated,
}: PageHeaderProps) {
  const { t } = useTranslation();
  const now = new Date().toLocaleString([], {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <header
      className={cn(
        "mb-8 border-b border-line pb-6",
        sticky && "sticky top-0 z-10 bg-overlay backdrop-blur-xl",
        className,
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          {subtitle && (
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-faint">{subtitle}</p>
          )}
          <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-[1.75rem]">{title}</h1>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-3 sm:justify-end">
          {showRefresh ? (
            <RefreshModeControl
              onRefresh={onRefresh}
              refreshing={refreshing}
              lastUpdated={lastUpdated}
              compact
            />
          ) : (
            <Badge label={t("common.online")} tone="success" live />
          )}
          <span className="inline-flex h-8 items-center rounded-md bg-surface px-3 font-mono text-xs text-muted ring-1 ring-ring-line">
            {now}
          </span>
          {action}
        </div>
      </div>
    </header>
  );
}
