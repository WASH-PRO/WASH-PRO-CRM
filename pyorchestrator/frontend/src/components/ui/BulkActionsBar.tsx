import Button from "@/components/ui/Button";
import { useTranslation } from "@/context/LocaleContext";
import { cn } from "@/lib/cn";

export interface BulkActionItem {
  id: string;
  label: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  disabled?: boolean;
  onClick: () => void;
}

interface BulkActionsBarProps {
  count: number;
  onClear: () => void;
  actions: BulkActionItem[];
  busy?: boolean;
  className?: string;
}

export default function BulkActionsBar({
  count,
  onClear,
  actions,
  busy,
  className,
}: BulkActionsBarProps) {
  const { t } = useTranslation();
  if (count === 0) return null;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 border-b border-cyan-400/20 bg-cyan-400/5 px-4 py-2.5 lg:px-5",
        className,
      )}
    >
      <span className="mr-1 text-sm font-medium text-foreground-secondary">
        {t("bulk.selected", { count })}
      </span>
      {actions.map((action) => (
        <Button
          key={action.id}
          size="sm"
          variant={action.variant ?? "secondary"}
          disabled={busy || action.disabled}
          onClick={action.onClick}
        >
          {action.label}
        </Button>
      ))}
      <Button size="sm" variant="ghost" disabled={busy} onClick={onClear}>
        {t("common.clear")}
      </Button>
    </div>
  );
}
