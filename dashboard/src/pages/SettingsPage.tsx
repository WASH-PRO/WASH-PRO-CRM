import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import {
  Save,
  HardDrive,
  Bell,
  Server,
  Workflow,
  ArrowUpCircle,
  RefreshCw,
  Radio,
  ShieldCheck,
  Palette,
  type LucideIcon,
} from 'lucide-react';
import { listCrmSettings, saveCrmSetting } from '../api/crmSettings';
import { syncMqttUsers } from '../api/postDevice';
import { SoftwareUpdatesSection, componentVersionLabel } from '../components/SoftwareUpdatesSection';
import { IntegrityRepairSection } from '../components/IntegrityRepairSection';
import { LanguageSelect } from '../components/LanguageToggle';
import { useAuth } from '../context/AuthContext';
import { useSoftwareUpdatesContext } from '../context/SoftwareUpdatesContext';
import { PageHeader, Loading } from '../components/UI';
import { PasswordInput } from '../components/PasswordInput';
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  getNotificationEventGroups,
  parseNotificationSettings,
} from '../utils/notificationSettings';
import {
  DEFAULT_MQTT_BROKER,
  MQTT_SYSTEM_LOGIN,
  parseMqttBrokerSettings,
} from '../utils/mqttBrokerSettings';
import type {
  BackupSettings,
  BrandingSettings,
  CrmSetting,
  DynamicApiCrmSettings,
  MqttBrokerSettings,
  NotificationSettings,
  PyOrchestratorCrmSettings,
  TelegramCrmSettings,
} from '../types';
import { useLocale } from '../i18n/LocaleContext';
import { useToast } from '../context/ToastContext';
import { useBranding } from '../context/BrandingContext';
import { DEFAULT_BRANDING, parseBranding } from '../utils/branding';

const DEFAULT_BACKUP: BackupSettings = {
  enabled: true,
  cron: '0 2 * * *',
  retentionCount: 7,
  storagePath: '/backups',
  fullBundle: true,
};

const DEFAULT_NOTIFICATIONS = DEFAULT_NOTIFICATION_SETTINGS;

const DEFAULT_PYORCH: PyOrchestratorCrmSettings = {
  email: 'admin@pyorchestrator.local',
  password: 'admin',
  panelPort: 8090,
};

const DEFAULT_DAP: DynamicApiCrmSettings = {
  serviceLogin: 'service',
  servicePassword: 'ServiceInternal123!',
  apiBaseUrl: 'http://dynamic-api:3001',
};

const DEFAULT_MQTT = DEFAULT_MQTT_BROKER;

const DEFAULT_TELEGRAM: TelegramCrmSettings = {
  token: '',
  adminIds: [],
  allowedCommands: [],
  enabled: false,
};

function parseTelegram(raw: Record<string, unknown>): TelegramCrmSettings {
  return {
    token: String(raw.token ?? ''),
    adminIds: Array.isArray(raw.adminIds)
      ? raw.adminIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)
      : [],
    allowedCommands: Array.isArray(raw.allowedCommands) ? raw.allowedCommands.map(String) : [],
    enabled: raw.enabled === true,
  };
}

function SettingSection({
  title,
  icon: Icon,
  children,
  className,
}: {
  title: string;
  icon: LucideIcon;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx('card h-full', className)}>
      <div className="mb-4 flex items-center gap-2 border-b border-panel-border pb-3 dark:border-panel-border-dark">
        <Icon className="h-4 w-4 text-brand-600 dark:text-brand-400" />
        <h3 className="text-sm font-semibold text-panel-ink dark:text-panel-ink-dark">{title}</h3>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-panel-muted dark:text-panel-muted-dark">{hint}</p>}
    </div>
  );
}

function parseNotifications(raw: Record<string, unknown>): NotificationSettings {
  return parseNotificationSettings(raw);
}

function parsePyOrch(raw: Record<string, unknown>): PyOrchestratorCrmSettings {
  return {
    email: String(raw.email ?? DEFAULT_PYORCH.email),
    password: String(raw.password ?? DEFAULT_PYORCH.password),
    panelPort: Number(raw.panelPort) || DEFAULT_PYORCH.panelPort,
  };
}

function parseDynamicApi(raw: Record<string, unknown>): DynamicApiCrmSettings {
  return {
    serviceLogin: String(raw.serviceLogin ?? DEFAULT_DAP.serviceLogin),
    servicePassword: String(raw.servicePassword ?? DEFAULT_DAP.servicePassword),
    apiBaseUrl: String(raw.apiBaseUrl ?? DEFAULT_DAP.apiBaseUrl),
  };
}

/** Legacy: service fields were previously stored in pyorchestrator. */
function legacyDynamicApiFromPyOrch(raw: Record<string, unknown>): DynamicApiCrmSettings | null {
  if (raw.serviceLogin == null && raw.servicePassword == null && raw.apiBaseUrl == null) return null;
  return {
    serviceLogin: String(raw.serviceLogin ?? DEFAULT_DAP.serviceLogin),
    servicePassword: String(raw.servicePassword ?? DEFAULT_DAP.servicePassword),
    apiBaseUrl: String(raw.apiBaseUrl ?? DEFAULT_DAP.apiBaseUrl),
  };
}

export function SettingsPage() {
  const { t } = useLocale();
  const { showToast } = useToast();
  const { refreshBranding } = useBranding();
  const { hasPermission } = useAuth();
  const canEdit = hasPermission('update');
  const canManageRepair = hasPermission('manage_users', 'manage_api');
  const updatesCtx = useSoftwareUpdatesContext();
  const [ids, setIds] = useState<Record<string, string | null>>({});
  const [backup, setBackup] = useState<BackupSettings>(DEFAULT_BACKUP);
  const [notifications, setNotifications] = useState<NotificationSettings>(DEFAULT_NOTIFICATIONS);
  const [telegram, setTelegram] = useState<TelegramCrmSettings>(DEFAULT_TELEGRAM);
  const [pyorch, setPyorch] = useState<PyOrchestratorCrmSettings>(DEFAULT_PYORCH);
  const [dynamicApi, setDynamicApi] = useState<DynamicApiCrmSettings>(DEFAULT_DAP);
  const [mqttBroker, setMqttBroker] = useState<MqttBrokerSettings>(DEFAULT_MQTT);
  const [branding, setBranding] = useState<BrandingSettings>(DEFAULT_BRANDING);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const notificationEventGroups = useMemo(() => getNotificationEventGroups(t), [t]);

  const applySettings = useCallback((rows: CrmSetting[]) => {
    const idMap: Record<string, string | null> = {
      backup: null,
      notifications: null,
      telegram: null,
      pyorchestrator: null,
      'dynamic-api': null,
      'mqtt-broker': null,
      branding: null,
    };

    let legacyPyOrchRaw: Record<string, unknown> | null = null;

    for (const row of rows) {
      idMap[row.key] = row.id;
      const v = row.value;
      if (row.key === 'backup') setBackup({ ...DEFAULT_BACKUP, ...(v as unknown as BackupSettings) });
      if (row.key === 'notifications') setNotifications(parseNotifications(v));
      if (row.key === 'telegram') setTelegram(parseTelegram(v));
      if (row.key === 'pyorchestrator') {
        legacyPyOrchRaw = v;
        setPyorch(parsePyOrch(v));
      }
      if (row.key === 'dynamic-api') setDynamicApi(parseDynamicApi(v));
      if (row.key === 'mqtt-broker') setMqttBroker(parseMqttBrokerSettings(v));
      if (row.key === 'branding') setBranding(parseBranding(v));
    }

    if (!idMap['dynamic-api'] && legacyPyOrchRaw) {
      const legacy = legacyDynamicApiFromPyOrch(legacyPyOrchRaw);
      if (legacy) setDynamicApi(legacy);
    }

    setIds(idMap);
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    listCrmSettings()
      .then(applySettings)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [applySettings]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!canEdit) return;
    setSaving(true);
    try {
      await Promise.all([
        saveCrmSetting('backup', backup as unknown as Record<string, unknown>, ids.backup ?? null),
        saveCrmSetting('notifications', notifications as unknown as Record<string, unknown>, ids.notifications ?? null),
        saveCrmSetting('telegram', telegram as unknown as Record<string, unknown>, ids.telegram ?? null),
        saveCrmSetting('pyorchestrator', pyorch as unknown as Record<string, unknown>, ids.pyorchestrator ?? null),
        saveCrmSetting('dynamic-api', dynamicApi as unknown as Record<string, unknown>, ids['dynamic-api'] ?? null),
        saveCrmSetting('mqtt-broker', mqttBroker as unknown as Record<string, unknown>, ids['mqtt-broker'] ?? null),
        saveCrmSetting('branding', branding as unknown as Record<string, unknown>, ids.branding ?? null),
      ]);
      try {
        await syncMqttUsers();
      } catch (syncErr) {
        console.error(syncErr);
        showToast(
          syncErr instanceof Error
            ? `${t('api.mqttSyncFailed')}: ${syncErr.message}`
            : t('api.mqttSyncFailed'),
          'error'
        );
        const rows = await listCrmSettings();
        applySettings(rows);
        return;
      }
      const rows = await listCrmSettings();
      applySettings(rows);
      await refreshBranding();
      showToast(t('api.saved'), 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('errors.saveFailed'), 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading />;

  return (
    <div>
      <PageHeader
        title={t('settings.title')}
        subtitle={t('settings.subtitle')}
        actions={
          <>
            <button type="button" className="btn-secondary" onClick={load}>
              <RefreshCw className="h-4 w-4" /> {t('common.refresh')}
            </button>
            {canEdit && (
              <button type="button" className="btn-primary" onClick={save} disabled={saving}>
                <Save className="h-4 w-4" /> {saving ? t('common.saving') : t('common.save')}
              </button>
            )}
          </>
        }
      />

      <div className="mb-4 card">
        <div className="mb-3 border-b border-panel-border pb-3 text-sm font-semibold dark:border-panel-border-dark">
          {t('settings.languageSection')}
        </div>
        <LanguageSelect />
        <p className="mt-2 text-xs text-panel-muted dark:text-panel-muted-dark">{t('settings.languageHint')}</p>
      </div>

      <div className="mb-4">
        <SettingSection title={t('pages.settings.branding.title')} icon={Palette}>
          <p className="text-xs text-panel-muted dark:text-panel-muted-dark">{t('pages.settings.branding.hint')}</p>
          <Field label={t('pages.settings.branding.productName')}>
            <input
              className="input"
              disabled={!canEdit}
              value={branding.productName}
              onChange={(e) => setBranding({ ...branding, productName: e.target.value })}
            />
          </Field>
          <Field label={t('pages.settings.branding.tagline')}>
            <input
              className="input"
              disabled={!canEdit}
              value={branding.tagline}
              onChange={(e) => setBranding({ ...branding, tagline: e.target.value })}
            />
          </Field>
          <Field label={t('pages.settings.branding.logoUrl')} hint={t('pages.settings.branding.logoUrlHint')}>
            <input
              className="input font-mono text-xs"
              disabled={!canEdit}
              value={branding.logoUrl}
              onChange={(e) => setBranding({ ...branding, logoUrl: e.target.value })}
              placeholder="https://…"
            />
          </Field>
          <Field label={t('pages.settings.branding.supportUrl')}>
            <input
              className="input font-mono text-xs"
              disabled={!canEdit}
              value={branding.supportUrl}
              onChange={(e) => setBranding({ ...branding, supportUrl: e.target.value })}
            />
          </Field>
          <Field label={t('pages.settings.branding.docsUrl')}>
            <input
              className="input font-mono text-xs"
              disabled={!canEdit}
              value={branding.docsUrl}
              onChange={(e) => setBranding({ ...branding, docsUrl: e.target.value })}
            />
          </Field>
        </SettingSection>
      </div>

      {!canEdit && (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
          {t('pages.settings.viewOnlyHint')}
        </p>
      )}

      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <SettingSection title={t('pages.settings.backup.title')} icon={HardDrive}>
          <p className="text-xs text-panel-muted dark:text-panel-muted-dark">
            {t('pages.settings.backup.hintStart')} <span className="font-mono">wash-backup</span>. {t('pages.settings.backup.hintMiddle')}{' '}
            <Link to="/backups" className="text-brand-600 hover:underline dark:text-brand-400">
              {t('nav.items.backups')}
            </Link>
            .
          </p>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={backup.enabled}
              disabled={!canEdit}
              onChange={(e) => setBackup({ ...backup, enabled: e.target.checked })}
            />
            {t('pages.settings.backup.auto')}
          </label>
          <Field label={t('pages.settings.backup.cron')} hint={t('pages.settings.backup.cronHint')}>
            <input className="input font-mono" value={backup.cron} disabled={!canEdit} onChange={(e) => setBackup({ ...backup, cron: e.target.value })} />
          </Field>
          <Field label={t('pages.settings.backup.retention')}>
            <input
              type="number"
              className="input"
              min={1}
              max={30}
              disabled={!canEdit}
              value={backup.retentionCount}
              onChange={(e) => setBackup({ ...backup, retentionCount: Number(e.target.value) || 7 })}
            />
          </Field>
          <Field label={t('pages.settings.backup.storagePath')} hint={t('pages.settings.backup.storageHint')}>
            <input
              className="input font-mono"
              disabled={!canEdit}
              value={backup.storagePath ?? '/backups'}
              onChange={(e) => setBackup({ ...backup, storagePath: e.target.value })}
            />
          </Field>
          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={backup.fullBundle !== false}
              disabled={!canEdit}
              onChange={(e) => setBackup({ ...backup, fullBundle: e.target.checked })}
            />
            <span>
              {t('pages.settings.backup.fullBundle')}
              <span className="mt-0.5 block text-xs text-panel-muted dark:text-panel-muted-dark">
                {t('pages.settings.backup.fullBundleHint')}
              </span>
            </span>
          </label>
        </SettingSection>

        <SettingSection title={t('pages.settings.pyorch.title')} icon={Server}>
          <p className="text-xs text-panel-muted dark:text-panel-muted-dark">
            {t('pages.settings.pyorch.hint')}
          </p>
          {componentVersionLabel(updatesCtx?.status ?? null, 'pyorchestrator') && (
            <p className="mb-3 font-mono text-xs text-brand-700 dark:text-brand-300">
              {t('pages.settings.version')}: {componentVersionLabel(updatesCtx?.status ?? null, 'pyorchestrator')}
            </p>
          )}
          <Field label={t('pages.settings.pyorch.adminEmail')}>
            <input className="input font-mono" disabled={!canEdit} value={pyorch.email} onChange={(e) => setPyorch({ ...pyorch, email: e.target.value })} />
          </Field>
          <Field label={t('pages.settings.pyorch.adminPassword')}>
            <PasswordInput
              className="font-mono"
              autoComplete="off"
              disabled={!canEdit}
              value={pyorch.password}
              onChange={(e) => setPyorch({ ...pyorch, password: e.target.value })}
            />
          </Field>
          <Field label={t('pages.settings.pyorch.panelPort')} hint={t('pages.settings.pyorch.panelPortHint')}>
            <input
              type="number"
              className="input"
              min={1}
              max={65535}
              disabled={!canEdit}
              value={pyorch.panelPort}
              onChange={(e) => setPyorch({ ...pyorch, panelPort: Number(e.target.value) || 8090 })}
            />
          </Field>
        </SettingSection>

        <SettingSection title={t('pages.settings.dynamicApi.title')} icon={Workflow}>
          <p className="text-xs text-panel-muted dark:text-panel-muted-dark">
            {t('pages.settings.dynamicApi.hint')}
          </p>
          {componentVersionLabel(updatesCtx?.status ?? null, 'dynamic-api') && (
            <p className="mb-3 font-mono text-xs text-brand-700 dark:text-brand-300">
              {t('pages.settings.version')}: {componentVersionLabel(updatesCtx?.status ?? null, 'dynamic-api')}
            </p>
          )}
          <Field label={t('pages.settings.dynamicApi.serviceLogin')} hint={t('pages.settings.dynamicApi.serviceLoginHint')}>
            <input
              className="input font-mono"
              disabled={!canEdit}
              value={dynamicApi.serviceLogin}
              onChange={(e) => setDynamicApi({ ...dynamicApi, serviceLogin: e.target.value })}
            />
          </Field>
          <Field label={t('pages.settings.dynamicApi.servicePassword')}>
            <PasswordInput
              className="font-mono"
              autoComplete="off"
              disabled={!canEdit}
              value={dynamicApi.servicePassword}
              onChange={(e) => setDynamicApi({ ...dynamicApi, servicePassword: e.target.value })}
            />
          </Field>
          <Field label={t('pages.settings.dynamicApi.baseUrl')} hint={t('pages.settings.dynamicApi.baseUrlHint')}>
            <input
              className="input font-mono"
              disabled={!canEdit}
              value={dynamicApi.apiBaseUrl}
              onChange={(e) => setDynamicApi({ ...dynamicApi, apiBaseUrl: e.target.value })}
            />
          </Field>
        </SettingSection>

        <SettingSection title={t('pages.settings.mqtt.title')} icon={Radio}>
          <p className="text-xs text-panel-muted dark:text-panel-muted-dark">
            {t('pages.settings.mqtt.hintStart')} <span className="font-mono">system</span> {t('pages.settings.mqtt.hintMiddle')}{' '}
            <span className="font-mono">message-processor</span> {t('pages.settings.mqtt.hintEnd')}
          </p>
          <Field label={t('pages.settings.mqtt.crmLogin')}>
            <input className="input font-mono" value={MQTT_SYSTEM_LOGIN} readOnly disabled />
          </Field>
          <Field
            label={t('pages.settings.mqtt.systemPassword')}
            hint={t('pages.settings.mqtt.systemPasswordHint')}
          >
            <PasswordInput
              className="font-mono"
              autoComplete="new-password"
              disabled={!canEdit}
              value={mqttBroker.systemPassword}
              onChange={(e) => setMqttBroker({ ...mqttBroker, systemPassword: e.target.value })}
            />
          </Field>
          <Field
            label={t('pages.settings.mqtt.retentionHours')}
            hint={t('pages.settings.mqtt.retentionHoursHint')}
          >
            <input
              className="input font-mono"
              type="number"
              min={1}
              disabled={!canEdit}
              value={mqttBroker.outboundRetentionHours}
              onChange={(e) =>
                setMqttBroker({ ...mqttBroker, outboundRetentionHours: Math.max(1, Number(e.target.value) || 168) })
              }
            />
          </Field>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              disabled={!canEdit}
              checked={mqttBroker.requireDeliveryConfirmation}
              onChange={(e) =>
                setMqttBroker({
                  ...mqttBroker,
                  requireDeliveryConfirmation: e.target.checked,
                  redeliverOnNoAck: e.target.checked ? mqttBroker.redeliverOnNoAck : false,
                })
              }
            />
            {t('pages.settings.mqtt.requireAck')} (<span className="font-mono">set/ack</span>)
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              disabled={!canEdit || !mqttBroker.requireDeliveryConfirmation}
              checked={mqttBroker.redeliverOnNoAck}
              onChange={(e) => setMqttBroker({ ...mqttBroker, redeliverOnNoAck: e.target.checked })}
            />
            {t('pages.settings.mqtt.redeliver')}
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('pages.settings.mqtt.redeliverInterval')} hint={t('pages.settings.mqtt.redeliverIntervalHint')}>
              <input
                className="input font-mono"
                type="number"
                min={5}
                disabled={!canEdit || !mqttBroker.redeliverOnNoAck}
                value={mqttBroker.redeliverIntervalSec}
                onChange={(e) =>
                  setMqttBroker({
                    ...mqttBroker,
                    redeliverIntervalSec: Math.max(5, Number(e.target.value) || 30),
                  })
                }
              />
            </Field>
            <Field label={t('pages.settings.mqtt.maxAttempts')} hint={t('pages.settings.mqtt.maxAttemptsHint')}>
              <input
                className="input font-mono"
                type="number"
                min={1}
                disabled={!canEdit || !mqttBroker.redeliverOnNoAck}
                value={mqttBroker.redeliverMaxAttempts}
                onChange={(e) =>
                  setMqttBroker({
                    ...mqttBroker,
                    redeliverMaxAttempts: Math.max(1, Number(e.target.value) || 5),
                  })
                }
              />
            </Field>
          </div>
        </SettingSection>
        </div>

        <SettingSection title={t('nav.items.notifications')} icon={Bell}>
          <p className="text-xs text-panel-muted dark:text-panel-muted-dark">
            {t('pages.settings.notifications.hintStart')}{' '}
            <span className="font-mono">message-processor</span> &amp; <span className="font-mono">wash-backup</span>{' '}
            {t('pages.settings.notifications.hintMiddle')}{' '}
            <Link to="/notifications" className="text-brand-600 hover:underline dark:text-brand-400">
              {t('nav.items.notifications')}
            </Link>
            .
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                disabled={!canEdit}
                checked={notifications.web}
                onChange={(e) => setNotifications({ ...notifications, web: e.target.checked })}
              />
              {t('notifications.channels.web')}
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                disabled={!canEdit}
                checked={notifications.telegram}
                onChange={(e) => setNotifications({ ...notifications, telegram: e.target.checked })}
              />
              {t('notifications.channels.telegram')}
            </label>
          </div>
          {notifications.telegram && (
            <div className="rounded-lg border border-panel-border p-4 dark:border-panel-border-dark">
              <p className="mb-3 text-xs text-panel-muted dark:text-panel-muted-dark">
                {t('pages.settings.notifications.botHint')}
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex cursor-pointer items-center gap-2 text-sm sm:col-span-2">
                  <input
                    type="checkbox"
                    disabled={!canEdit}
                    checked={telegram.enabled}
                    onChange={(e) => setTelegram({ ...telegram, enabled: e.target.checked })}
                  />
                  {t('pages.settings.notifications.botEnabled')}
                </label>
                <Field label={t('pages.settings.notifications.botToken')}>
                  <PasswordInput
                    className="font-mono text-xs"
                    disabled={!canEdit}
                    value={telegram.token}
                    onChange={(e) => setTelegram({ ...telegram, token: e.target.value })}
                    placeholder="123456:ABC..."
                    autoComplete="off"
                  />
                </Field>
                <Field label={t('pages.settings.notifications.adminIds')} hint={t('pages.settings.notifications.adminIdsHint')}>
                  <input
                    className="input font-mono text-xs"
                    disabled={!canEdit}
                    value={telegram.adminIds.join(', ')}
                    onChange={(e) => {
                      const adminIds = e.target.value
                        .split(/[,;\s]+/)
                        .map((part) => Number(part.trim()))
                        .filter((id) => Number.isInteger(id) && id > 0);
                      setTelegram({ ...telegram, adminIds });
                    }}
                    placeholder="123456789, 987654321"
                  />
                </Field>
              </div>
              {notifications.telegram && telegram.enabled && (!telegram.token.trim() || telegram.adminIds.length === 0) && (
                <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">
                  {t('pages.settings.notifications.botWarning')}
                </p>
              )}
            </div>
          )}
          <Field label={t('pages.settings.notifications.events')}>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {notificationEventGroups.map((group) => (
                <div key={group.title} className="rounded-lg border border-panel-border p-3 dark:border-panel-border-dark">
                  <p className="mb-2 text-xs font-medium text-panel-muted dark:text-panel-muted-dark">{group.title}</p>
                  <div className="space-y-2">
                    {group.items.map(({ key, label }) => (
                      <label key={key} className="flex cursor-pointer items-start gap-2 text-sm leading-snug">
                        <input
                          type="checkbox"
                          className="mt-0.5 shrink-0"
                          disabled={!canEdit}
                          checked={notifications.events[key] !== false}
                          onChange={(e) =>
                            setNotifications({
                              ...notifications,
                              events: { ...notifications.events, [key]: e.target.checked },
                            })
                          }
                        />
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Field>
        </SettingSection>

        <SettingSection title={t('pages.settings.repair.title')} icon={ShieldCheck}>
          <IntegrityRepairSection canManage={canManageRepair} />
        </SettingSection>

        <SettingSection title={t('pages.settings.softwareUpdates')} icon={ArrowUpCircle}>
          <SoftwareUpdatesSection />
        </SettingSection>
      </div>
    </div>
  );
}
