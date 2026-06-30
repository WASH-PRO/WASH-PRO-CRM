import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { FieldGroup, FieldLabel, Input } from "@/components/ui/Input";
import Panel from "@/components/ui/Panel";
import type { UpdateJob, UpdateStatus } from "@/components/UpdateBanner";
import { cn } from "@/lib/cn";
import { api } from "@/api/client";
import { useTranslation } from "@/context/LocaleContext";
import { useToast } from "@/context/ToastContext";
import {
  ArrowPathIcon,
  ArrowRightIcon,
  ArrowUpCircleIcon,
  CheckCircleIcon,
  CloudArrowDownIcon,
  Cog6ToothIcon,
  ExclamationTriangleIcon,
  ServerStackIcon,
} from "@heroicons/react/24/outline";
import { useCallback, useEffect, useState } from "react";

interface UpdateSettings {
  check_enabled: boolean;
  notify_enabled: boolean;
  auto_update_enabled: boolean;
  check_interval_hours: number;
  auto_update_interval_hours: number;
  github_repo: string;
  include_prerelease: boolean;
  last_check_at: string | null;
  last_known_latest_version: string | null;
}

interface FullStatus extends UpdateStatus {
  settings: UpdateSettings;
  checked_at: string;
  deploy_mode: string;
  recent_jobs: UpdateJob[];
}

function stepTone(status: string): "success" | "warning" | "danger" | "accent" | "neutral" {
  if (status === "completed") return "success";
  if (status === "running") return "accent";
  if (status === "failed") return "danger";
  if (status === "skipped") return "warning";
  return "neutral";
}

function StepIndicator({ step, index, isLast }: { step: UpdateJob["steps"][0]; index: number; isLast: boolean }) {
  const tone = stepTone(step.status);
  const ring =
    tone === "success"
      ? "border-emerald-500 bg-emerald-500/10 text-emerald-400"
      : tone === "accent"
        ? "border-cyan-400 bg-cyan-400/10 text-cyan-400"
        : tone === "danger"
          ? "border-red-500 bg-red-500/10 text-red-400"
          : "border-line bg-inset text-faint";

  return (
    <div className="flex min-w-0 flex-1 items-start gap-3">
      <div className="flex flex-col items-center">
        <div
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold",
            ring,
            step.status === "running" && "animate-pulse",
          )}
        >
          {step.status === "completed" ? <CheckCircleIcon className="size-4" /> : index + 1}
        </div>
        {!isLast && <div className="mt-1 h-full min-h-8 w-px bg-line-strong" />}
      </div>
      <div className="min-w-0 pb-5 pt-0.5">
        <p className="text-sm font-medium text-foreground">{step.label}</p>
        {step.message && <p className="mt-0.5 text-xs text-muted">{step.message}</p>}
      </div>
    </div>
  );
}

function ToggleCard({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer gap-3 rounded-xl border p-4 transition-colors",
        checked ? "border-cyan-400/30 bg-cyan-400/5" : "border-line bg-canvas/40 hover:border-line-strong",
      )}
    >
      <input
        type="checkbox"
        className="mt-0.5 size-4 shrink-0 rounded border-line text-cyan-400 focus:ring-cyan-400/30"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-foreground">{label}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-muted">{description}</span>
      </span>
    </label>
  );
}

export default function UpdatesSettingsPanel() {
  const { t } = useTranslation();
  const toast = useToast();
  const [status, setStatus] = useState<FullStatus | null>(null);
  const [settings, setSettings] = useState<UpdateSettings | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const data = await api<FullStatus>("/api/v1/updates/status");
    setStatus(data);
    setSettings(data.settings);
  }, []);

  useEffect(() => {
    void load();
    const interval = setInterval(() => void load(), status?.active_job ? 3000 : 30000);
    return () => clearInterval(interval);
  }, [load, status?.active_job?.id]);

  const saveSettings = async () => {
    if (!settings) return;
    setBusy(true);
    try {
      await api("/api/v1/updates/settings", {
        method: "PUT",
        body: JSON.stringify(settings),
      });
      toast.success(t("settings.updates.saved"));
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("settings.updates.saveFailed"));
    } finally {
      setBusy(false);
    }
  };

  const checkNow = async () => {
    setBusy(true);
    try {
      await api("/api/v1/updates/check", { method: "POST" });
      toast.success(t("settings.updates.checked"));
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("settings.updates.checkFailed"));
    } finally {
      setBusy(false);
    }
  };

  const applyNow = async () => {
    setBusy(true);
    try {
      await api("/api/v1/updates/apply", { method: "POST", body: "{}" });
      toast.success(t("settings.updates.started"));
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("settings.updates.applyFailed"));
    } finally {
      setBusy(false);
    }
  };

  const cancelJob = async (jobId: string) => {
    setBusy(true);
    try {
      await api(`/api/v1/updates/jobs/${jobId}/cancel`, { method: "POST" });
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("settings.updates.cancelFailed"));
    } finally {
      setBusy(false);
    }
  };

  if (!status || !settings) {
    return (
      <Panel title={t("settings.updates.title")} subtitle={t("settings.updates.subtitle")} className="md:col-span-2 xl:col-span-3">
        <div className="flex items-center gap-3 text-sm text-muted">
          <ArrowPathIcon className="size-5 animate-spin text-primary" />
          {t("common.loading")}
        </div>
      </Panel>
    );
  }

  const job = status.active_job;

  return (
    <Panel
      title={t("settings.updates.title")}
      subtitle={t("settings.updates.subtitle")}
      className="md:col-span-2 xl:col-span-3"
      bodyClassName="space-y-6"
      action={
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => void checkNow()}>
            <ArrowPathIcon className="size-4" />
            {t("settings.updates.check")}
          </Button>
          <Button
            size="sm"
            disabled={busy || !status.update_available || !status.executor_available}
            onClick={() => void applyNow()}
          >
            <CloudArrowDownIcon className="size-4" />
            {t("settings.updates.apply")}
          </Button>
        </div>
      }
    >
      <div className="overflow-hidden rounded-2xl border border-line bg-gradient-to-br from-cyan-400/8 via-transparent to-transparent p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <div className="rounded-xl border border-line bg-surface/80 px-4 py-3 backdrop-blur-sm">
              <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-faint">
                {t("settings.updates.installed")}
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">v{status.current_version}</p>
            </div>
            <ArrowRightIcon className="hidden size-5 shrink-0 text-faint sm:block" />
            <div className="rounded-xl border border-line bg-surface/80 px-4 py-3 backdrop-blur-sm">
              <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-faint">
                {t("settings.updates.latest")}
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
                {status.latest_version ? `v${status.latest_version}` : "—"}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {status.update_available ? (
              <Badge label={t("settings.updates.badgeAvailable")} tone="warning" live />
            ) : (
              <Badge label={t("settings.updates.badgeUpToDate")} tone="success" />
            )}
            <Badge
              label={
                status.executor_available
                  ? t("settings.updates.executorReady")
                  : t("settings.updates.executorUnavailable")
              }
              tone={status.executor_available ? "success" : "warning"}
            />
            <Badge label={status.deploy_mode} tone="neutral" />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
          <span>
            {t("settings.updates.lastCheck")}:{" "}
            <span className="font-medium text-foreground-secondary">
              {status.checked_at ? new Date(status.checked_at).toLocaleString() : "—"}
            </span>
          </span>
          {status.release_url && (
            <a href={status.release_url} target="_blank" rel="noopener" className="font-medium text-primary hover:underline">
              {t("settings.updates.viewRelease")}
            </a>
          )}
        </div>
      </div>

      {!status.executor_available && status.executor_reason && (
        <div className="flex gap-3 rounded-xl border border-amber-500/25 bg-amber-500/8 p-4">
          <ExclamationTriangleIcon className="size-5 shrink-0 text-amber-400" />
          <div>
            <p className="text-sm font-medium text-foreground">{t("settings.updates.executorUnavailable")}</p>
            <p className="mt-1 text-sm text-muted">{status.executor_reason}</p>
          </div>
        </div>
      )}

      {status.update_available && status.release_notes && !job && (
        <div className="rounded-xl border border-line bg-canvas/50 p-4">
          <div className="mb-2 flex items-center gap-2">
            <ArrowUpCircleIcon className="size-4 text-primary" />
            <p className="text-sm font-semibold text-foreground">{t("settings.updates.releaseNotes")}</p>
          </div>
          <pre className="max-h-40 overflow-auto whitespace-pre-wrap font-sans text-xs leading-relaxed text-muted">
            {status.release_notes.trim()}
          </pre>
        </div>
      )}

      {job && (
        <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/5 p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">
                {t("settings.updates.activeJob", { from: job.from_version, to: job.target_version })}
              </p>
              <p className="mt-0.5 text-xs text-muted">{t("settings.updates.activeJobHint")}</p>
            </div>
            {["queued", "running"].includes(job.status) && (
              <Button size="sm" variant="secondary" disabled={busy} onClick={() => void cancelJob(job.id)}>
                {t("settings.updates.cancel")}
              </Button>
            )}
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {job.steps.map((step, index) => (
              <StepIndicator key={step.id} step={step} index={index} isLast={index === job.steps.length - 1} />
            ))}
          </div>
        </div>
      )}

      {status.recent_jobs.filter((j) => j.id !== job?.id && j.status === "failed").length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-foreground">{t("settings.updates.recentJobsTitle")}</p>
          {status.recent_jobs
            .filter((j) => j.id !== job?.id && j.status === "failed")
            .slice(0, 3)
            .map((recent) => (
              <div
                key={recent.id}
                className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm"
              >
                <p className="font-medium text-foreground">
                  {t("settings.updates.recentJobFailed", {
                    from: recent.from_version,
                    to: recent.target_version,
                  })}
                </p>
                {recent.error && (
                  <p className="mt-1 whitespace-pre-wrap font-mono text-xs text-muted">{recent.error}</p>
                )}
              </div>
            ))}
        </div>
      )}

      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Cog6ToothIcon className="size-4 text-faint" />
          <h3 className="text-sm font-semibold text-foreground">{t("settings.updates.behaviorTitle")}</h3>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <ToggleCard
            label={t("settings.updates.checkEnabled")}
            description={t("settings.updates.checkEnabledDesc")}
            checked={settings.check_enabled}
            onChange={(check_enabled) => setSettings({ ...settings, check_enabled })}
          />
          <ToggleCard
            label={t("settings.updates.notifyEnabled")}
            description={t("settings.updates.notifyEnabledDesc")}
            checked={settings.notify_enabled}
            onChange={(notify_enabled) => setSettings({ ...settings, notify_enabled })}
          />
          <ToggleCard
            label={t("settings.updates.autoEnabled")}
            description={t("settings.updates.autoEnabledDesc")}
            checked={settings.auto_update_enabled}
            onChange={(auto_update_enabled) => setSettings({ ...settings, auto_update_enabled })}
          />
          <ToggleCard
            label={t("settings.updates.includePrerelease")}
            description={t("settings.updates.includePrereleaseDesc")}
            checked={settings.include_prerelease}
            onChange={(include_prerelease) => setSettings({ ...settings, include_prerelease })}
          />
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <ServerStackIcon className="size-4 text-faint" />
          <h3 className="text-sm font-semibold text-foreground">{t("settings.updates.configurationTitle")}</h3>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <FieldGroup>
            <FieldLabel htmlFor="update-repo">{t("settings.updates.githubRepo")}</FieldLabel>
            <Input
              id="update-repo"
              value={settings.github_repo}
              onChange={(e) => setSettings({ ...settings, github_repo: e.target.value })}
            />
          </FieldGroup>
          <FieldGroup>
            <FieldLabel htmlFor="update-check-interval">{t("settings.updates.checkInterval")}</FieldLabel>
            <Input
              id="update-check-interval"
              type="number"
              min={1}
              max={168}
              value={settings.check_interval_hours}
              onChange={(e) => setSettings({ ...settings, check_interval_hours: Number(e.target.value) })}
            />
          </FieldGroup>
          <FieldGroup>
            <FieldLabel htmlFor="update-auto-interval">{t("settings.updates.autoInterval")}</FieldLabel>
            <Input
              id="update-auto-interval"
              type="number"
              min={1}
              max={720}
              value={settings.auto_update_interval_hours}
              onChange={(e) => setSettings({ ...settings, auto_update_interval_hours: Number(e.target.value) })}
            />
          </FieldGroup>
        </div>
      </div>

      <div className="flex justify-end border-t border-line pt-4">
        <Button disabled={busy} onClick={() => void saveSettings()}>
          {t("settings.updates.save")}
        </Button>
      </div>
    </Panel>
  );
}
