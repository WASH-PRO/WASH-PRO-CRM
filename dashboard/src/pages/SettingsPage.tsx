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
  type LucideIcon,
} from 'lucide-react';
import { listCrmSettings, saveCrmSetting } from '../api/crmSettings';
import WashSoftwareUpdatesSection from '../components/WashSoftwareUpdatesSection';
import { PageHeader, Loading } from '../components/UI';
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  NOTIFICATION_EVENT_GROUPS,
  parseNotificationSettings,
} from '../utils/notificationSettings';
import type {
  BackupSettings,
  CrmSetting,
  DynamicApiCrmSettings,
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
  const [ids, setIds] = useState<Record<string, string | null>>({});
  const [backup, setBackup] = useState<BackupSettings>(DEFAULT_BACKUP);
  const [notifications, setNotifications] = useState<NotificationSettings>(DEFAULT_NOTIFICATIONS);
  const [pyorch, setPyorch] = useState<PyOrchestratorCrmSettings>(DEFAULT_PYORCH);
  const [dynamicApi, setDynamicApi] = useState<DynamicApiCrmSettings>(DEFAULT_DAP);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const applySettings = useCallback((rows: CrmSetting[]) => {
    const idMap: Record<string, string | null> = {
      backup: null,
      notifications: null,
      pyorchestrator: null,
      'dynamic-api': null,
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
    setSaving(true);
    try {
      await Promise.all([
        saveCrmSetting('backup', backup as unknown as Record<string, unknown>, ids.backup ?? null),
        saveCrmSetting('notifications', notifications as unknown as Record<string, unknown>, ids.notifications ?? null),
        saveCrmSetting('pyorchestrator', pyorch as unknown as Record<string, unknown>, ids.pyorchestrator ?? null),
        saveCrmSetting('dynamic-api', dynamicApi as unknown as Record<string, unknown>, ids['dynamic-api'] ?? null),
      ]);
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
            <button type="button" className="btn-primary" onClick={save} disabled={saving}>
              <Save className="h-4 w-4" /> {saving ? 'Сохранение…' : 'Сохранить'}
            </button>
          </>
        }
      />

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
              onChange={(e) => setBackup({ ...backup, enabled: e.target.checked })}
            />
            Автоматическое резервное копирование
          </label>
          <Field label="Расписание (cron)" hint="Формат cron, например 0 2 * * * — каждый день в 02:00">
            <input className="input font-mono" value={backup.cron} onChange={(e) => setBackup({ ...backup, cron: e.target.value })} />
          </Field>
          <Field label="Количество хранимых копий">
            <input
              type="number"
              className="input"
              min={1}
              max={30}
              value={backup.retentionCount}
              onChange={(e) => setBackup({ ...backup, retentionCount: Number(e.target.value) || 7 })}
            />
          </Field>
          <Field label="Путь хранения" hint="Каталог внутри контейнера backup">
            <input
              className="input font-mono"
              value={backup.storagePath ?? '/backups'}
              onChange={(e) => setBackup({ ...backup, storagePath: e.target.value })}
            />
          </Field>
        </SettingSection>

        <SettingSection title="PyOrchestrator" icon={Server}>
          <p className="text-xs text-panel-muted dark:text-panel-muted-dark">
            Учётная запись администратора и порт встроенной панели PyOrchestrator.
          </p>
          <Field label="Email администратора">
            <input className="input font-mono" value={pyorch.email} onChange={(e) => setPyorch({ ...pyorch, email: e.target.value })} />
          </Field>
          <Field label="Пароль администратора">
            <input
              className="input font-mono"
              type="password"
              autoComplete="off"
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
              value={pyorch.panelPort}
              onChange={(e) => setPyorch({ ...pyorch, panelPort: Number(e.target.value) || 8090 })}
            />
          </Field>
        </SettingSection>

        <SettingSection title="Dynamic API" icon={Workflow}>
          <p className="text-xs text-panel-muted dark:text-panel-muted-dark">
            Service account и внутренний URL для bridge-сервисов (бот, backup, processor).
          </p>
          <Field label="Service login" hint="Учётная запись для внутренних сервисов">
            <input
              className="input font-mono"
              value={dynamicApi.serviceLogin}
              onChange={(e) => setDynamicApi({ ...dynamicApi, serviceLogin: e.target.value })}
            />
          </Field>
          <Field label="Service password">
            <input
              className="input font-mono"
              type="password"
              autoComplete="off"
              value={dynamicApi.servicePassword}
              onChange={(e) => setDynamicApi({ ...dynamicApi, servicePassword: e.target.value })}
            />
          </Field>
          <Field label="API base URL" hint="Базовый URL Dynamic API внутри Docker-сети">
            <input
              className="input font-mono"
              value={dynamicApi.apiBaseUrl}
              onChange={(e) => setDynamicApi({ ...dynamicApi, apiBaseUrl: e.target.value })}
            />
          </Field>
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
                checked={notifications.web}
                onChange={(e) => setNotifications({ ...notifications, web: e.target.checked })}
              />
              Уведомления в веб-панели
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
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
          <WashSoftwareUpdatesSection />
        </SettingSection>
      </div>
    </div>
  );
}
