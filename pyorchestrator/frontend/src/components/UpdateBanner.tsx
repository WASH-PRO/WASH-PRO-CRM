import Button from "@/components/ui/Button";
import { api } from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import { useTranslation } from "@/context/LocaleContext";
import { useToast } from "@/context/ToastContext";
import { ArrowPathIcon, ArrowUpCircleIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";

export interface UpdateStep {
  id: string;
  label: string;
  status: string;
  message?: string | null;
}

export interface UpdateJob {
  id: string;
  status: string;
  from_version: string;
  target_version: string;
  target_tag: string;
  steps: UpdateStep[];
  error?: string | null;
}

export interface UpdateStatus {
  current_version: string;
  latest_version: string | null;
  latest_tag: string | null;
  update_available: boolean;
  release_url: string | null;
  release_notes: string | null;
  executor_available: boolean;
  executor_reason: string | null;
  show_notification: boolean;
  active_job: UpdateJob | null;
}

export default function UpdateBanner() {
  if (import.meta.env.VITE_WASH_EMBEDDED === 'true') return null;

  const { user } = useAuth();
  const { t } = useTranslation();
  const toast = useToast();
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (user?.role !== "Administrator") return;
    try {
      const data = await api<UpdateStatus>("/api/v1/updates/status");
      setStatus(data);
    } catch {
      setStatus(null);
    }
  }, [user?.role]);

  useEffect(() => {
    void load();
    const active = status?.active_job;
    const interval = setInterval(() => void load(), active ? 3000 : 60000);
    return () => clearInterval(interval);
  }, [load, status?.active_job?.id, status?.active_job?.status]);

  if (user?.role !== "Administrator" || !status) return null;

  const job = status.active_job;
  if (job) {
    const runningStep = job.steps.find((s) => s.status === "running") ?? job.steps.find((s) => s.status === "pending");
    return (
      <div className="border-b border-cyan-500/30 bg-cyan-500/10 px-4 py-3">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3">
          <ArrowPathIcon className="h-5 w-5 shrink-0 animate-spin text-primary" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">
              {t("updates.banner.updating", {
                from: job.from_version,
                to: job.target_version,
              })}
            </p>
            {runningStep && (
              <p className="text-xs text-muted">
                {runningStep.label}
                {runningStep.message ? ` — ${runningStep.message}` : ""}
              </p>
            )}
          </div>
          <Link to="/settings" className="text-xs font-medium text-primary hover:underline">
            {t("updates.banner.details")}
          </Link>
        </div>
      </div>
    );
  }

  if (!status.show_notification || !status.update_available || !status.latest_version) return null;

  const dismiss = async () => {
    setBusy(true);
    try {
      await api("/api/v1/updates/dismiss", {
        method: "POST",
        body: JSON.stringify({ version: status.latest_version }),
      });
      await load();
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    setBusy(true);
    try {
      await api("/api/v1/updates/apply", { method: "POST", body: "{}" });
      toast.success(t("updates.banner.started"));
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("updates.banner.failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-3">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3">
        <ArrowUpCircleIcon className="h-5 w-5 shrink-0 text-amber-400" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">
            {t("updates.banner.available", { version: status.latest_version })}
          </p>
          <p className="text-xs text-muted">
            {t("updates.banner.current", { version: status.current_version })}
            {status.release_url && (
              <>
                {" · "}
                <a href={status.release_url} target="_blank" rel="noopener" className="text-primary hover:underline">
                  {t("updates.banner.releaseNotes")}
                </a>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" disabled={busy || !status.executor_available} onClick={() => void apply()}>
            {t("updates.banner.updateNow")}
          </Button>
          <Link to="/settings" className="text-xs font-medium text-primary hover:underline">
            {t("updates.banner.settings")}
          </Link>
          <button
            type="button"
            className="rounded p-1 text-muted hover:bg-surface hover:text-foreground"
            aria-label={t("updates.banner.dismiss")}
            disabled={busy}
            onClick={() => void dismiss()}
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
