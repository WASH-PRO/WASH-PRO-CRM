import { cn } from "@/lib/cn";

export interface MetricItem {
  label: string;
  value: number | string;
  hint?: string;
  tone?: "default" | "accent" | "success" | "warning" | "danger";
}

const toneColor = {
  default: "text-foreground",
  accent: "text-cyan-400",
  success: "text-emerald-400",
  warning: "text-amber-400",
  danger: "text-red-400",
};

export default function MetricsStrip({ items }: { items: MetricItem[] }) {
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-inset ring-1 ring-ring-line sm:grid-cols-3 xl:grid-cols-6">
      {items.map((item) => (
        <div
          key={item.label}
          className="flex min-w-0 flex-col justify-center bg-panel px-4 py-4 sm:px-5"
        >
          <dt className="text-[0.625rem] font-semibold uppercase tracking-wider text-faint">{item.label}</dt>
          <dd
            className={cn(
              "mt-1.5 break-words text-sm font-semibold tabular-nums leading-snug sm:text-base",
              toneColor[item.tone ?? "default"],
            )}
          >
            {item.value}
          </dd>
          {item.hint && (
            <dd className="mt-1 min-h-[1rem] truncate text-[0.6875rem] text-faint">{item.hint}</dd>
          )}
        </div>
      ))}
    </dl>
  );
}

export function MetricInline({ label, value, unit }: { label: string; value: string | number; unit?: string }) {
  return (
    <div className="text-center sm:text-left">
      <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-faint">{label}</p>
      <p className="mt-1 text-sm font-semibold tabular-nums text-foreground-secondary">
        {value}
        {unit && <span className="ml-1 text-xs font-normal text-faint">{unit}</span>}
      </p>
    </div>
  );
}

export function MetricFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-6 grid grid-cols-2 gap-4 border-t border-line pt-5 sm:grid-cols-4">
      {children}
    </div>
  );
}
