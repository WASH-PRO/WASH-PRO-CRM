import {
  CommandLineIcon,
  CpuChipIcon,
  PlayIcon,
  StopIcon,
  TrashIcon,
} from "@heroicons/react/20/solid";
import { useEffect, useState } from "react";
import Badge from "@/components/ui/Badge";
import { IconButton } from "@/components/ui/Button";
import { SelectionCheckbox } from "@/components/ui/SelectionCheckbox";
import { cn } from "@/lib/cn";
import { useTranslation } from "@/context/LocaleContext";

export interface ActiveRunInfo {
  id: string;
  status: string;
  started_at: string | null;
  queued_at: string;
}

export interface ScriptCardData {
  id: string;
  name: string;
  slug: string;
  description: string;
  status: string;
  script_type: string;
  entrypoint: string;
  group_id: string | null;
  active_run?: ActiveRunInfo | null;
}

interface ScriptCardProps {
  script: ScriptCardData;
  groupName?: string;
  groupColor?: string;
  busy?: boolean;
  canRun?: boolean;
  canDelete?: boolean;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  onOpen: () => void;
  onRun: () => void;
  onStop: () => void;
  onDelete: () => void;
}

function previewLines(script: ScriptCardData): string[] {
  if (script.description.trim()) {
    return script.description.trim().split("\n").slice(0, 4);
  }
  if (script.script_type === "bot") {
    return ["async def on_message(msg):", "    await handle(msg)", "    return None"];
  }
  return [`# ${script.slug}`, `run("${script.entrypoint}")`, "..."];
}

function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const remS = s % 60;
  if (m < 60) return `${m}m ${remS}s`;
  const h = Math.floor(m / 60);
  const remM = m % 60;
  return `${h}h ${remM}m`;
}

function useElapsedSeconds(sinceIso: string | null | undefined): number {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!sinceIso) {
      setSeconds(0);
      return;
    }
    const start = new Date(sinceIso).getTime();
    const tick = () => setSeconds(Math.floor((Date.now() - start) / 1000));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [sinceIso]);

  return seconds;
}

export default function ScriptCard({
  script,
  groupName,
  groupColor,
  busy,
  canRun,
  canDelete,
  selectable,
  selected,
  onToggleSelect,
  onOpen,
  onRun,
  onStop,
  onDelete,
}: ScriptCardProps) {
  const { t } = useTranslation();
  const lines = previewLines(script);
  const TypeIcon = script.script_type === "bot" ? CpuChipIcon : CommandLineIcon;
  const activeRun = script.active_run;
  const isActive = activeRun?.status === "running" || activeRun?.status === "queued";
  const elapsedSince = activeRun?.started_at ?? activeRun?.queued_at;
  const elapsedSeconds = useElapsedSeconds(isActive ? elapsedSince : null);
  const runStatusTone =
    activeRun?.status === "running" ? "success" : activeRun?.status === "queued" ? "warning" : "neutral";

  return (
    <article
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-xl bg-panel ring-1 ring-ring-line transition-shadow hover:ring-cyan-400/25",
        selected && "ring-cyan-400/40",
        isActive && "ring-emerald-400/30",
      )}
    >
      {selectable && onToggleSelect && (
        <div className="absolute left-3 top-3 z-10">
          <SelectionCheckbox
            checked={Boolean(selected)}
            onChange={onToggleSelect}
            ariaLabel={t("common.selectItem", { name: script.name })}
          />
        </div>
      )}
      <button
        type="button"
        onClick={onOpen}
        className="flex min-h-0 flex-1 flex-col text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-panel"
      >
        <div className="relative h-32 shrink-0 overflow-hidden border-b border-line bg-input">
          {groupColor && (
            <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: groupColor }} />
          )}
          <div
            className={cn(
              "absolute inset-0 opacity-80",
              script.script_type === "bot"
                ? "bg-gradient-to-br from-emerald-400/10 via-transparent to-transparent"
                : "bg-gradient-to-br from-cyan-400/10 via-transparent to-transparent",
            )}
          />
          <div className="relative flex h-full flex-col px-3 py-2.5">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="inline-flex min-w-0 items-center gap-1.5 font-mono text-[10px] text-faint">
                <TypeIcon className="size-3.5 shrink-0 text-cyan-400/80" />
                <span className="truncate">{script.entrypoint}</span>
              </span>
              <Badge
                label={script.script_type}
                tone={script.script_type === "bot" ? "success" : "accent"}
              />
            </div>
            <pre className="flex-1 overflow-hidden font-mono text-[11px] leading-5 text-muted">
              {lines.map((line, i) => (
                <span key={i} className="block truncate">
                  {line.startsWith("#") ? (
                    <span className="text-faint">{line}</span>
                  ) : line.includes("def ") || line.includes("async ") ? (
                    <>
                      <span className="text-cyan-400/90">{line.split("(")[0]}</span>
                      {line.includes("(") ? `(${line.split("(").slice(1).join("(")}` : ""}
                    </>
                  ) : (
                    line
                  )}
                </span>
              ))}
            </pre>
          </div>
        </div>

        <div className="flex flex-1 flex-col p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h3 className="truncate font-semibold text-foreground group-hover:text-cyan-400">
                {script.name}
              </h3>
              <p className="mt-0.5 truncate font-mono text-xs text-faint">{script.slug}</p>
            </div>
            <Badge label={script.status} tone={script.status === "enabled" ? "success" : "neutral"} />
          </div>

          {isActive && activeRun && (
            <div className="mt-3 flex items-center justify-between gap-2 rounded-lg bg-surface-muted px-3 py-2 ring-1 ring-ring-line">
              <div className="flex min-w-0 items-center gap-2">
                {activeRun.status === "running" && (
                  <span className="relative flex size-2 shrink-0">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                    <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
                  </span>
                )}
                <Badge
                  label={t(`scriptCard.runStatus.${activeRun.status}`)}
                  tone={runStatusTone}
                />
              </div>
              <span className="shrink-0 font-mono text-xs tabular-nums text-muted">
                {formatDuration(elapsedSeconds)}
              </span>
            </div>
          )}

          {groupName && (
            <p className="mt-3 truncate text-xs text-faint">
              {t("scriptCard.group", { name: groupName })}
            </p>
          )}

          <p className="mt-3 text-xs font-medium text-dim group-hover:text-faint">{t("common.openEditor")}</p>
        </div>
      </button>

      {(canRun || canDelete) && (
        <div className="flex items-center justify-end gap-1 border-t border-line px-3 py-2">
          {canRun && isActive && (
            <IconButton
              aria-label={t("scriptCard.stopScript")}
              disabled={busy}
              onClick={(e) => {
                e.stopPropagation();
                onStop();
              }}
              className="text-amber-400 hover:text-amber-300"
            >
              <StopIcon className="size-4" />
            </IconButton>
          )}
          {canRun && !isActive && (
            <IconButton
              aria-label={t("scriptCard.runScript")}
              disabled={busy}
              onClick={(e) => {
                e.stopPropagation();
                onRun();
              }}
            >
              <PlayIcon className="size-4" />
            </IconButton>
          )}
          {canDelete && (
            <IconButton
              aria-label={t("scriptCard.deleteScript")}
              disabled={busy}
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="hover:text-red-400"
            >
              <TrashIcon className="size-4" />
            </IconButton>
          )}
        </div>
      )}
    </article>
  );
}
