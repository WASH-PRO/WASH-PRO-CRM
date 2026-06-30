import { MoonIcon, SunIcon } from "@heroicons/react/20/solid";
import { useTheme } from "@/context/ThemeContext";
import { useTranslation } from "@/context/LocaleContext";
import { cn } from "@/lib/cn";

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

export default function ThemeToggle({ className, showLabel = false }: ThemeToggleProps) {
  const { t } = useTranslation();
  const { resolved, toggleTheme } = useTheme();
  const isDark = resolved === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md p-1.5 text-muted transition-colors",
        "hover:bg-hover hover:text-cyan-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400",
        showLabel && "w-full px-3 py-2 text-sm font-medium",
        className,
      )}
      aria-label={isDark ? t("theme.switchToLight") : t("theme.switchToDark")}
      title={isDark ? t("theme.light") : t("theme.dark")}
    >
      {isDark ? (
        <SunIcon className={cn("size-5", showLabel && "text-amber-400")} />
      ) : (
        <MoonIcon className={cn("size-5", showLabel && "text-cyan-400")} />
      )}
      {showLabel && <span>{isDark ? t("theme.light") : t("theme.dark")}</span>}
    </button>
  );
}

export function ThemeOption({
  value,
  label,
  description,
  icon: Icon,
  active,
  onSelect,
}: {
  value: "dark" | "light" | "system";
  label: string;
  description: string;
  icon: typeof SunIcon;
  active: boolean;
  onSelect: (value: "dark" | "light" | "system") => void;
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

export { MoonIcon, SunIcon };
