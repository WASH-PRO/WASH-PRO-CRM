import { cn } from "@/lib/cn";

export type BadgeTone = "success" | "warning" | "danger" | "neutral" | "accent";

const styles: Record<BadgeTone, string> = {
  success: "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20",
  warning: "bg-amber-500/10 text-amber-400 ring-amber-500/20",
  danger: "bg-red-500/10 text-red-400 ring-red-500/20",
  accent: "bg-cyan-400/10 text-cyan-400 ring-cyan-400/20",
  neutral: "bg-inset text-muted ring-ring-line",
};

const dotColors: Record<BadgeTone, string> = {
  success: "bg-emerald-400",
  warning: "bg-amber-400",
  danger: "bg-red-400",
  accent: "bg-cyan-400",
  neutral: "bg-dim",
};

export default function Badge({
  label,
  tone = "neutral",
  live,
  className,
}: {
  label: string;
  tone?: BadgeTone;
  live?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-x-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset",
        styles[tone],
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", dotColors[tone], live && "status-dot-live")} />
      {label}
    </span>
  );
}

export function StatusRow({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number | string;
  tone?: BadgeTone;
}) {
  const valueColors: Record<BadgeTone, string> = {
    success: "text-emerald-400",
    warning: "text-amber-400",
    danger: "text-red-400",
    accent: "text-cyan-400",
    neutral: "text-foreground-secondary",
  };

  return (
    <div className="flex items-center justify-between border-b border-line py-3 last:border-0">
      <span className="text-sm text-muted">{label}</span>
      <span className={cn("text-sm font-semibold tabular-nums", valueColors[tone])}>{value}</span>
    </div>
  );
}
