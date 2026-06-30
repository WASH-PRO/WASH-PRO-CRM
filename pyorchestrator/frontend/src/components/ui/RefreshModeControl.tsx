import Button from "@/components/ui/Button";
import {
  REFRESH_INTERVALS,
  useRefreshMode,
  useRelativeTime,
  type RefreshInterval,
} from "@/context/RefreshModeContext";
import { useTranslation } from "@/context/LocaleContext";
import { Select } from "@/components/ui/Input";
import { cn } from "@/lib/cn";
import { ArrowPathIcon, BoltIcon, PauseIcon } from "@heroicons/react/20/solid";

interface RefreshModeControlProps {
  onRefresh?: () => void;
  refreshing?: boolean;
  lastUpdated?: Date | null;
  compact?: boolean;
  className?: string;
}

export default function RefreshModeControl({
  onRefresh,
  refreshing = false,
  lastUpdated = null,
  compact = false,
  className,
}: RefreshModeControlProps) {
  const { t } = useTranslation();
  const { mode, setMode, intervalMs, setIntervalSec, isLive } = useRefreshMode();
  const relative = useRelativeTime(lastUpdated ?? null);
  const intervalSec = intervalMs / 1000;

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <div className="inline-flex rounded-lg bg-surface p-0.5 ring-1 ring-ring-line">
        <ModeButton
          active={mode === "live"}
          onClick={() => setMode("live")}
          icon={<BoltIcon className="size-3.5" />}
          label={t("refresh.live")}
        />
        <ModeButton
          active={mode === "static"}
          onClick={() => setMode("static")}
          icon={<PauseIcon className="size-3.5" />}
          label={t("refresh.static")}
        />
      </div>

      {isLive && !compact && (
        <Select
          value={intervalSec}
          onChange={(e) => setIntervalSec(Number(e.target.value) as RefreshInterval)}
          className="h-8 w-[5.5rem] text-xs"
          aria-label={t("refresh.refreshInterval")}
        >
          {REFRESH_INTERVALS.map((sec) => (
            <option key={sec} value={sec}>
              {sec}s
            </option>
          ))}
        </Select>
      )}

      {onRefresh && (
        <Button
          variant="secondary"
          size="sm"
          onClick={onRefresh}
          disabled={refreshing}
          icon={<ArrowPathIcon className={cn("size-4", refreshing && "animate-spin")} />}
          aria-label={t("refresh.refreshNow")}
        >
          {!compact && t("refresh.refresh")}
        </Button>
      )}

      {(relative || isLive) && (
        <span
          className={cn(
            "inline-flex items-center gap-1.5 text-xs text-faint",
            isLive && "text-cyan-400/80",
          )}
        >
          {isLive && <span className="size-1.5 rounded-full bg-cyan-400 status-dot-live" />}
          {relative ? t("refresh.updated", { time: relative }) : isLive ? t("refresh.live") : t("refresh.static")}
        </span>
      )}
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors",
        active
          ? "bg-cyan-400/15 text-cyan-400 ring-1 ring-inset ring-cyan-400/25"
          : "text-faint hover:text-foreground-secondary",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

export function RefreshModeBadge() {
  const { t } = useTranslation();
  const { isLive } = useRefreshMode();
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset",
        isLive
          ? "bg-cyan-400/10 text-cyan-400 ring-cyan-400/20"
          : "bg-inset text-muted ring-ring-line",
      )}
    >
      <span className={cn("size-1.5 rounded-full", isLive ? "bg-cyan-400 status-dot-live" : "bg-dim")} />
      {isLive ? t("refresh.live") : t("refresh.static")}
    </span>
  );
}
