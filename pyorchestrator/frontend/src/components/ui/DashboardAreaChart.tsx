import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTheme, type ResolvedTheme } from "@/context/ThemeContext";

export interface ChartSeries {
  dataKey: string;
  label: string;
  color: string;
}

const chartThemes: Record<
  ResolvedTheme,
  { grid: string; tick: string; tooltip: Record<string, string | number> }
> = {
  dark: {
    grid: "#334155",
    tick: "#94a3b8",
    tooltip: {
      background: "#0f172a",
      border: "1px solid #334155",
      borderRadius: 8,
      fontSize: 12,
      color: "#f1f5f9",
    },
  },
  light: {
    grid: "#e2e8f0",
    tick: "#64748b",
    tooltip: {
      background: "#ffffff",
      border: "1px solid #e2e8f0",
      borderRadius: 8,
      fontSize: 12,
      color: "#0f172a",
    },
  },
};

interface DashboardAreaChartProps {
  data: Record<string, string | number>[];
  series: ChartSeries[];
  xKey?: string;
  height?: number;
}

export default function DashboardAreaChart({
  data,
  series,
  xKey = "hour",
  height = 220,
}: DashboardAreaChartProps) {
  const { resolved } = useTheme();
  const chartTheme = chartThemes[resolved];

  if (data.length < 2) {
    return (
      <div className="flex items-center justify-center text-sm text-muted" style={{ height }}>
        —
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} vertical={false} />
        <XAxis
          dataKey={xKey}
          tick={{ fill: chartTheme.tick, fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fill: chartTheme.tick, fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={36}
          allowDecimals={false}
        />
        <Tooltip contentStyle={chartTheme.tooltip} labelStyle={{ color: chartTheme.tick }} />
        {series.length > 1 && <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconType="circle" />}
        {series.map((s) => (
          <Area
            key={s.dataKey}
            type="monotone"
            dataKey={s.dataKey}
            name={s.label}
            stroke={s.color}
            fill={`${s.color}40`}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 3, strokeWidth: 0 }}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}
