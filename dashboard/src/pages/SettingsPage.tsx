import { useCallback, useEffect, useState, type ReactNode } from 'react';
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
  type LucideIcon,
} from 'lucide-react';
import { listCrmSettings, saveCrmSetting } from '../api/crmSettings';
import { syncMqttUsers } from '../api/postDevice';
import { SoftwareUpdatesSection, componentVersionLabel } from '../components/SoftwareUpdatesSection';
import { useAuth } from '../context/AuthContext';
import { useSoftwareUpdatesContext } from '../context/SoftwareUpdatesContext';
import { PageHeader, Loading } from '../components/UI';
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  NOTIFICATION_EVENT_GROUPS,
  parseNotificationSettings,
} from '../utils/notificationSettings';
import {
  DEFAULT_MQTT_BROKER,
  MQTT_SYSTEM_LOGIN,
  parseMqttBrokerSettings,
} from '../utils/mqttBrokerSettings';
import type {
  BackupSettings,
  CrmSetting,
  DynamicApiCrmSettings,
  MqttBrokerSettings,
  NotificationSettings,
  PyOrchestratorCrmSettings,
} from '../types';

const DEFAULT_BACKUP: BackupSettings = {
  enabled: true,
  cron: '0 2 * * *',
  retentionCount: 7,
  storagePath: '/backups',
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

/** Legacy: service-поля раньше хранились в pyorchestrator. */
function legacyDynamicApiFromPyOrch(raw: Record<string, unknown>): DynamicApiCrmSettings | null {
  if (raw.serviceLogin == null && raw.servicePassword == null && raw.apiBaseUrl == null) return null;
  return {
    serviceLogin: String(raw.serviceLogin ?? DEFAULT_DAP.serviceLogin),
    servicePassword: String(raw.servicePassword ?? DEFAULT_DAP.servicePassword),
    apiBaseUrl: String(raw.apiBaseUrl ?? DEFAULT_DAP.apiBaseUrl),
  };
}

export function SettingsPage() {
  const { hasPermission } = useAuth();
  const canEdit = hasPermission('update');
  const updatesCtx = useSoftwareUpdatesContext();
  const [ids, setIds] = useState<Record<string, string | null>>({});
  const [backup, setBackup] = useState<BackupSettings>(DEFAULT_BACKUP);
  const [notifications, setNotifications] = useState<NotificationSettings>(DEFAULT_NOTIFICATIONS);
  const [pyorch, setPyorch] = useState<PyOrchestratorCrmSettings>(DEFAULT_PYORCH);
  const [dynamicApi, setDynamicApi] = useState<DynamicApiCrmSettings>(DEFAULT_DAP);
  const [mqttBroker, setMqttBroker] = useState<MqttBrokerSettings>(DEFAULT_MQTT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const applySettings = useCallback((rows: CrmSetting[]) => {
    const idMap: Record<string, string | null> = {
      backup: null,
      notifications: null,
      pyorchestrator: null,
      'dynamic-api': null,
      'mqtt-broker': null,
    };

    let legacyPyOrchRaw: Record<string, unknown> | null = null;

    for (const row of rows) {
      idMap[row.key] = row.id;
      const v = row.value;
      if (row.key === 'backup') setBackup({ ...DEFAULT_BACKUP, ...(v as unknown as BackupSettings) });
      if (row.key === 'notifications') setNotifications(parseNotifications(v));
      if (row.key === 'pyorchestrator') {
        legacyPyOrchRaw = v;
        setPyorch(parsePyOrch(v));
      }
      if (row.key === 'dynamic-api') setDynamicApi(parseDynamicApi(v));
      if (row.key === 'mqtt-broker') setMqttBroker(parseMqttBrokerSettings(v));
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
        saveCrmSetting('pyorchestrator', pyorch as unknown as Record<string, unknown>, ids.pyorchestrator ?? null),
        saveCrmSetting('dynamic-api', dynamicApi as unknown as Record<string, unknown>, ids['dynamic-api'] ?? null),
        saveCrmSetting('mqtt-broker', mqttBroker as unknown as Record<string, unknown>, ids['mqtt-broker'] ?? null),
      ]);
      try {
        await syncMqttUsers();
      } catch (syncErr) {
        console.error(syncErr);
        alert(
          syncErr instanceof Error
            ? `Настройки сохранены, но синхронизация MQTT не удалась: ${syncErr.message}`
            : 'Настройки сохранены, но синхронизация MQTT не удалась'
        );
        const rows = await listCrmSettings();
        applySettings(rows);
        return;
      }
      const rows = await listCrmSettings();
      applySettings(rows);
      alert('Настройки сохранены');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading />;

  return (
    <div>
      <PageHeader
        title="Настройки"
        subtitle="Параметры WASH PRO CRM — резервное копирование, интеграции и уведомления"
        actions={
          <>
            <button type="button" className="btn-secondary" onClick={load}>
              <RefreshCw className="h-4 w-4" /> Обновить
            </button>
            {canEdit && (
              <button type="button" className="btn-primary" onClick={save} disabled={saving}>
                <Save className="h-4 w-4" /> {saving ? 'Сохранение…' : 'Сохранить'}
              </button>
            )}
          </>
        }
      />

      {!canEdit && (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
          Режим просмотра: изменение настроек доступно операторам и администраторам.
        </p>
      )}

      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <SettingSection title="Резервное копирование" icon={HardDrive}>
          <p className="text-xs text-panel-muted dark:text-panel-muted-dark">
            Используется сервисом <span className="font-mono">wash-backup</span>. Список копий — на странице{' '}
            <Link to="/backups" className="text-brand-600 hover:underline dark:text-brand-400">
              Резервные копии
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
            Автоматическое резервное копирование
          </label>
          <Field label="Расписание (cron)" hint="Формат cron, например 0 2 * * * — каждый день в 02:00">
            <input className="input font-mono" value={backup.cron} disabled={!canEdit} onChange={(e) => setBackup({ ...backup, cron: e.target.value })} />
          </Field>
          <Field label="Количество хранимых копий">
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
          <Field label="Путь хранения" hint="Каталог внутри контейнера backup">
            <input
              className="input font-mono"
              disabled={!canEdit}
              value={backup.storagePath ?? '/backups'}
              onChange={(e) => setBackup({ ...backup, storagePath: e.target.value })}
            />
          </Field>
        </SettingSection>

        <SettingSection title="PyOrchestrator" icon={Server}>
          <p className="text-xs text-panel-muted dark:text-panel-muted-dark">
            Учётная запись администратора и порт встроенной панели PyOrchestrator.
          </p>
          {componentVersionLabel(updatesCtx?.status ?? null, 'pyorchestrator') && (
            <p className="mb-3 font-mono text-xs text-brand-700 dark:text-brand-300">
              Версия: {componentVersionLabel(updatesCtx?.status ?? null, 'pyorchestrator')}
            </p>
          )}
          <Field label="Email администратора">
            <input className="input font-mono" disabled={!canEdit} value={pyorch.email} onChange={(e) => setPyorch({ ...pyorch, email: e.target.value })} />
          </Field>
          <Field label="Пароль администратора">
            <input
              className="input font-mono"
              type="password"
              autoComplete="off"
              disabled={!canEdit}
              value={pyorch.password}
              onChange={(e) => setPyorch({ ...pyorch, password: e.target.value })}
            />
          </Field>
          <Field label="Порт панели" hint="Внешний порт панели PyOrchestrator (по умолчанию 8090)">
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

        <SettingSection title="Dynamic API" icon={Workflow}>
          <p className="text-xs text-panel-muted dark:text-panel-muted-dark">
            Service account и внутренний URL для bridge-сервисов (бот, backup, processor).
          </p>
          {componentVersionLabel(updatesCtx?.status ?? null, 'dynamic-api') && (
            <p className="mb-3 font-mono text-xs text-brand-700 dark:text-brand-300">
              Версия: {componentVersionLabel(updatesCtx?.status ?? null, 'dynamic-api')}
            </p>
          )}
          <Field label="Service login" hint="Учётная запись для внутренних сервисов">
            <input
              className="input font-mono"
              disabled={!canEdit}
              value={dynamicApi.serviceLogin}
              onChange={(e) => setDynamicApi({ ...dynamicApi, serviceLogin: e.target.value })}
            />
          </Field>
          <Field label="Service password">
            <input
              className="input font-mono"
              type="password"
              autoComplete="off"
              disabled={!canEdit}
              value={dynamicApi.servicePassword}
              onChange={(e) => setDynamicApi({ ...dynamicApi, servicePassword: e.target.value })}
            />
          </Field>
          <Field label="API base URL" hint="Базовый URL Dynamic API внутри Docker-сети">
            <input
              className="input font-mono"
              disabled={!canEdit}
              value={dynamicApi.apiBaseUrl}
              onChange={(e) => setDynamicApi({ ...dynamicApi, apiBaseUrl: e.target.value })}
            />
          </Field>
        </SettingSection>

        <SettingSection title="MQTT (CRM)" icon={Radio}>
          <p className="text-xs text-panel-muted dark:text-panel-muted-dark">
            Учётная запись <span className="font-mono">system</span> для подключения{' '}
            <span className="font-mono">message-processor</span> к Mosquitto. Пароль постов задаётся в карточке поста.
          </p>
          <Field label="Логин CRM в брокере">
            <input className="input font-mono" value={MQTT_SYSTEM_LOGIN} readOnly disabled />
          </Field>
          <Field
            label="Пароль system"
            hint="После сохранения пароль применяется в Mosquitto и переподключает processor"
          >
            <input
              className="input font-mono"
              type="password"
              autoComplete="new-password"
              disabled={!canEdit}
              value={mqttBroker.systemPassword}
              onChange={(e) => setMqttBroker({ ...mqttBroker, systemPassword: e.target.value })}
            />
          </Field>
          <Field
            label="Хранение исходящих MQTT (часы)"
            hint="Срок хранения команд и цен в outbox CRM до автоочистки (по умолчанию 168 = 7 суток)"
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
            Требовать подтверждение доставки от устройства (топик <span className="font-mono">set/ack</span>)
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              disabled={!canEdit || !mqttBroker.requireDeliveryConfirmation}
              checked={mqttBroker.redeliverOnNoAck}
              onChange={(e) => setMqttBroker({ ...mqttBroker, redeliverOnNoAck: e.target.checked })}
            />
            Повторно отправлять, если подтверждение не получено
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Интервал повтора (сек)" hint="Между попытками доставки без ack">
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
            <Field label="Макс. попыток" hint="Включая первую отправку">
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

        <SettingSection title="Уведомления" icon={Bell}>
          <p className="text-xs text-panel-muted dark:text-panel-muted-dark">
            Каналы и типы событий для оповещений операторов. Сервисы{' '}
            <span className="font-mono">message-processor</span> и <span className="font-mono">wash-backup</span>{' '}
            читают эти настройки при создании записей. Список — на странице{' '}
            <Link to="/notifications" className="text-brand-600 hover:underline dark:text-brand-400">
              Уведомления
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
              Уведомления в веб-панели
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                disabled={!canEdit}
                checked={notifications.telegram}
                onChange={(e) => setNotifications({ ...notifications, telegram: e.target.checked })}
              />
              Уведомления в Telegram
            </label>
          </div>
          <Field label="События">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {NOTIFICATION_EVENT_GROUPS.map((group) => (
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

        <SettingSection title="Обновления ПО" icon={ArrowUpCircle}>
          <SoftwareUpdatesSection />
        </SettingSection>
      </div>
    </div>
  );
}
