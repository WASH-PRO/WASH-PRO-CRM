import { cn } from "@/lib/cn";
import type { ComponentType } from "react";
import type { Locale } from "@/context/LocaleContext";

export function LocaleOption({
  value,
  label,
  description,
  icon: Icon,
  active,
  onSelect,
}: {
  value: Locale;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  active: boolean;
  onSelect: (value: Locale) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className={cn(
        "flex w-full items-start gap-3 rounded-lg px-4 py-3 text-left ring-1 ring-inset transition-colors",
        active
          ? "bg-cyan-400/10 ring-cyan-400/30"
          : "bg-surface-muted ring-ring-line hover:bg-hover-subtle",
      )}
    >
      <Icon className={cn("mt-0.5 size-5 shrink-0", active ? "text-cyan-400" : "text-faint")} />
      <span>
        <span className="block text-sm font-semibold text-foreground">{label}</span>
        <span className="mt-0.5 block text-xs text-faint">{description}</span>
      </span>
    </button>
  );
}
