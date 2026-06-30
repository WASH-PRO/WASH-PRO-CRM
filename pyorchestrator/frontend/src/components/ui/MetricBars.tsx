export interface BarItem {
  label: string;
  value: number;
  color?: string;
}

export default function MetricBars({ items, horizontal = true }: { items: BarItem[]; horizontal?: boolean }) {
  const max = Math.max(...items.map((i) => i.value), 1);

  if (!horizontal) {
    return (
      <div className="flex h-36 items-end gap-3 pt-2">
        {items.map((item) => (
          <div key={item.label} className="flex flex-1 flex-col items-center text-center">
            <div
              className="w-full min-h-[6px] rounded-t-md transition-all duration-500"
              style={{
                height: `${Math.max(6, (item.value / max) * 100)}%`,
                backgroundColor: item.color ?? "#22d3ee",
                opacity: 0.85,
              }}
            />
            <span className="mt-2 text-xs text-faint">{item.label}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <div key={item.label}>
          <div className="mb-1.5 flex justify-between text-sm">
            <span className="text-muted">{item.label}</span>
            <span className="font-semibold tabular-nums text-foreground-secondary">{item.value}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-track">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${(item.value / max) * 100}%`,
                backgroundColor: item.color ?? "#22d3ee",
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
