interface GaugeProps {
  value: number;
  max?: number;
  label: string;
  unit?: string;
  size?: number;
}

export default function LoadGauge({ value, max = 100, label, unit = "", size = 128 }: GaugeProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const stroke = Math.max(8, Math.round(size * 0.0625));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c * 0.72;
  const gap = c - dash;

  const valueClass =
    size >= 220 ? "text-5xl" : size >= 176 ? "text-4xl" : size >= 144 ? "text-3xl" : "text-2xl";
  const unitClass = size >= 176 ? "text-base" : "text-sm";
  const labelClass = size >= 176 ? "text-sm" : "text-xs";

  return (
    <div className="flex flex-col items-center text-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: "rotate(135deg)" }}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="var(--po-track)"
            strokeWidth={stroke}
            strokeDasharray={`${c * 0.72} ${c * 0.28}`}
            strokeLinecap="round"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="#22d3ee"
            strokeWidth={stroke}
            strokeDasharray={`${dash} ${gap + c * 0.28}`}
            strokeLinecap="round"
            className="transition-all duration-500"
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <span className={`${valueClass} font-bold tabular-nums tracking-tight text-foreground`}>
            {value}
            {unit && (
              <span className={`ml-0.5 font-normal text-faint ${unitClass}`}>{unit}</span>
            )}
          </span>
        </div>
      </div>
      <p className={`mt-4 ${labelClass} text-muted`}>{label}</p>
    </div>
  );
}
