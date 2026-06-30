import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

interface PanelProps {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  flush?: boolean;
  noPadding?: boolean;
  accentColor?: string;
}

export default function Panel({
  title,
  subtitle,
  action,
  children,
  className,
  bodyClassName,
  flush,
  noPadding,
  accentColor,
}: PanelProps) {
  const hasHeader = title || subtitle || action;

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-xl bg-panel ring-1 ring-ring-line",
        accentColor && "border-t-2",
        className,
      )}
      style={accentColor ? { borderTopColor: accentColor } : undefined}
    >
      {hasHeader && (
        <div
          className={cn(
            "flex min-h-14 shrink-0 items-center justify-between gap-4 px-5 py-3",
            !flush && "border-b border-line",
          )}
        >
          <div className="min-w-0">
            {subtitle && (
              <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-faint">{subtitle}</p>
            )}
            {title && <h3 className="text-sm font-semibold leading-tight text-foreground">{title}</h3>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div
        className={cn(
          "flex flex-1 flex-col",
          !noPadding && !flush && "p-5",
          flush && "min-h-0",
          bodyClassName,
        )}
      >
        {children}
      </div>
    </div>
  );
}
