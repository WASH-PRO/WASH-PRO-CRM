interface ChartProps {
  data: number[];
  height?: number;
  color?: string;
  gradientId?: string;
}

function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return "";
  let d = `M ${points[0].x},${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cpx = (prev.x + curr.x) / 2;
    d += ` C ${cpx},${prev.y} ${cpx},${curr.y} ${curr.x},${curr.y}`;
  }
  return d;
}

export default function ActivityChart({
  data,
  height = 220,
  color = "#22d3ee",
  gradientId = "areaFill",
}: ChartProps) {
  if (data.length < 2) data = [0, 0];

  const w = 1000;
  const h = 100;
  const padX = 12;
  const padY = 12;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;

  const coords = data.map((v, i) => ({
    x: padX + (i / (data.length - 1)) * (w - padX * 2),
    y: h - padY - ((v - min) / range) * (h - padY * 2),
  }));

  const linePath = smoothPath(coords);
  const areaPath = `${linePath} L ${coords[coords.length - 1].x},${h - padY} L ${coords[0].x},${h - padY} Z`;

  return (
    <div className="relative w-full" style={{ height }}>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" width="100%" height="100%">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.18} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        {[25, 50, 75].map((pct) => {
          const y = h - padY - (pct / 100) * (h - padY * 2);
          return (
            <line key={pct} x1={padX} y1={y} x2={w - padX} y2={y} stroke="rgba(255,255,255,0.035)" strokeWidth={1} />
          );
        })}
        <path d={areaPath} fill={`url(#${gradientId})`} />
        <path d={linePath} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}
