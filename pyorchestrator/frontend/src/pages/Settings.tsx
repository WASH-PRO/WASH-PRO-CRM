import { ComputerDesktopIcon, GlobeAltIcon, LanguageIcon } from "@heroicons/react/20/solid";
import { useCallback, useEffect, useState } from "react";
import PageContainer, { PageContent } from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import { FieldGroup, FieldLabel, Input } from "@/components/ui/Input";
import { LocaleOption } from "@/components/ui/LocaleOption";
import Panel from "@/components/ui/Panel";
import { MoonIcon, SunIcon, ThemeOption } from "@/components/ui/ThemeToggle";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { api, API_URL } from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import { useTranslation } from "@/context/LocaleContext";
import { useToast } from "@/context/ToastContext";
import { useTheme } from "@/context/ThemeContext";

export default function SettingsPage() {
  const { t, locale, setLocale } = useTranslation();
  const toast = useToast();
  const [displayName, setDisplayName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [profileBusy, setProfileBusy] = useState(false);
  const { user, refreshUser } = useAuth();
  const { theme, setTheme, resolved } = useTheme();

  useEffect(() => {
    if (user) setDisplayName(user.display_name);
  }, [user]);

  const fetchInfo = useCallback(() => api<{ version: string }>("/api/v1/system/info"), []);
  const { data: info, reload, refreshing, lastUpdated } = useLiveQuery(fetchInfo, [], {
    intervalMs: 60_000,
  });

  const version = info?.version ?? "";

  const saveProfile = async () => {
    setProfileBusy(true);
    try {
      await api("/api/v1/auth/me", {
        method: "PATCH",
        body: JSON.stringify({
          display_name: displayName.trim(),
          current_password: newPassword ? currentPassword : undefined,
          new_password: newPassword || undefined,
        }),
      });
      setCurrentPassword("");
      setNewPassword("");
      toast.success(t("settings.profile.updated"));
      await refreshUser();
    } catch {
      toast.error(t("settings.profile.updateFailed"));
    } finally {
      setProfileBusy(false);
    }
  };

  const profileValid = displayName.trim() && (!newPassword || (currentPassword && newPassword.length >= 6));

  return (
    <PageContainer>
      <PageHeader
        title={t("settings.title")}
        subtitle={t("settings.subtitle")}
        onRefresh={reload}
        refreshing={refreshing}
        lastUpdated={lastUpdated}
      />

      <PageContent>
        <div className="grid auto-rows-fr grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          <Panel title={t("settings.profile.title")} subtitle={user?.email} bodyClassName="space-y-4">
            <FieldGroup>
              <FieldLabel htmlFor="profile-name">{t("settings.profile.displayName")}</FieldLabel>
              <Input
                id="profile-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </FieldGroup>
            <FieldGroup>
              <FieldLabel htmlFor="profile-current">{t("settings.profile.currentPassword")}</FieldLabel>
              <Input
                id="profile-current"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder={t("settings.profile.passwordRequired")}
              />
            </FieldGroup>
            <FieldGroup>
              <FieldLabel htmlFor="profile-new">{t("settings.profile.newPassword")}</FieldLabel>
              <Input
                id="profile-new"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={t("settings.profile.passwordMin")}
              />
            </FieldGroup>
            <div className="flex flex-wrap items-center gap-3">
              <Button disabled={!profileValid || profileBusy} onClick={saveProfile}>
                {t("settings.profile.saveProfile")}
              </Button>
              <p className="text-xs text-faint">
                {t("settings.profile.role")}: <span className="text-muted">{user?.role}</span>
              </p>
            </div>
          </Panel>

          <Panel title={t("settings.localization.title")} subtitle={t("settings.localization.subtitle")} bodyClassName="space-y-3">
            <LocaleOption
              value="en"
              label={t("settings.localization.english")}
              description={t("settings.localization.englishDesc")}
              icon={LanguageIcon}
              active={locale === "en"}
              onSelect={setLocale}
            />
            <LocaleOption
              value="ru"
              label={t("settings.localization.russian")}
              description={t("settings.localization.russianDesc")}
              icon={GlobeAltIcon}
              active={locale === "ru"}
              onSelect={setLocale}
            />
            <p className="pt-1 text-xs text-faint">
              {t("settings.localization.activeNow")}:{" "}
              <span className="font-medium text-muted">
                {locale === "ru" ? t("settings.localization.russian") : t("settings.localization.english")}
              </span>
            </p>
          </Panel>

          <Panel title={t("settings.appearance.title")} subtitle={t("settings.appearance.subtitle")} bodyClassName="space-y-3">
            <ThemeOption
              value="dark"
              label={t("settings.appearance.dark")}
              description={t("settings.appearance.darkDesc")}
              icon={MoonIcon}
              active={theme === "dark"}
              onSelect={setTheme}
            />
            <ThemeOption
              value="light"
              label={t("settings.appearance.light")}
              description={t("settings.appearance.lightDesc")}
              icon={SunIcon}
              active={theme === "light"}
              onSelect={setTheme}
            />
            <ThemeOption
              value="system"
              label={t("settings.appearance.system")}
              description={t("settings.appearance.systemDesc")}
              icon={ComputerDesktopIcon}
              active={theme === "system"}
              onSelect={setTheme}
            />
            <p className="pt-1 text-xs text-faint">
              {t("settings.appearance.activeNow")}:{" "}
              <span className="font-medium text-muted">
                {resolved === "dark" ? t("settings.appearance.dark") : t("settings.appearance.light")}
              </span>
              {" · "}
              {t("settings.appearance.quickToggle")}
            </p>
          </Panel>

          <Panel title={t("settings.system.title")} bodyClassName="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-faint">{t("settings.system.version")}</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{version || "—"}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-faint">{t("settings.system.apiEndpoint")}</p>
              <p className="mt-1 break-all font-mono text-xs leading-relaxed text-foreground-secondary">{API_URL}</p>
            </div>
          </Panel>

          {user?.role === "Administrator" && (
            <Panel title={t("settings.updates.title")} subtitle={t("settings.updates.subtitle")} bodyClassName="flex flex-col gap-4">
              <Button
                variant="secondary"
                className="w-fit"
                onClick={async () => {
                  const result = await api<{ update_available: boolean; latest_version: string | null }>(
                    "/api/v1/system/updates/check",
                  );
                  toast.info(
                    result.update_available
                      ? t("settings.updates.available", { version: result.latest_version ?? "" })
                      : t("settings.updates.upToDate"),
                  );
                }}
              >
                {t("settings.updates.check")}
              </Button>
            </Panel>
          )}
        </div>
      </PageContent>
    </PageContainer>
  );
}
