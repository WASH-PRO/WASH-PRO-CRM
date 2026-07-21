import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Pencil, Play, Plus, QrCode, RefreshCw, Square, Trash2 } from 'lucide-react';
import {
  WASH_TELEGRAM_COMMAND_GROUPS,
  TELEGRAM_BOT_COMMAND_PRESETS,
  TELEGRAM_BOT_TYPE_LABELS,
  TELEGRAM_BOT_TYPE_OPTIONS,
  checkTelegramBridgeHealth,
  createTelegramBot,
  deleteTelegramBot,
  getTelegramBotLink,
  listTelegramBots,
  startTelegramBot,
  stopTelegramBot,
  updateTelegramBot,
  type TelegramBot,
  type TelegramBotLink,
  type TelegramBotType,
} from '../api/telegramBots';
import { PasswordInput } from '../components/PasswordInput';
import { Badge, Empty, ErrorMessage, Loading, Modal, PageHeader } from '../components/UI';
import { DataTable, type DataTableBulkAction, type DataTableColumn, type DataTableFilter } from '../components/DataTable';
import { LIVE_INTERVAL_SLOW_MS } from '../constants/live';
import { useToast } from '../context/ToastContext';
import { usePolling } from '../hooks/usePolling';
import { createExportBulkAction } from '../utils/export';
import { formatDateTime } from '../utils/format';
import { useLocale } from '../i18n/LocaleContext';

interface BotForm {
  name: string;
  token: string;
  botType: TelegramBotType;
  commands: string[];
  description: string;
  startAfterCreate: boolean;
}

const EMPTY_FORM: BotForm = {
  name: '',
  token: '',
  botType: 'management',
  commands: [...TELEGRAM_BOT_COMMAND_PRESETS.management],
  description: '',
  startAfterCreate: true,
};

function resolveBotType(bot: TelegramBot): TelegramBotType {
  const raw = bot.metadata.bot_type;
  if (raw === 'informational' || raw === 'service' || raw === 'management') return raw;
  return 'management';
}

type PageState = 'loading' | 'ready' | 'unavailable';

type TranslateFn = (key: string, params?: Record<string, string | number>) => string;

function runStatus(
  bot: TelegramBot,
  t: TranslateFn
): { label: string; variant: 'success' | 'warning' | 'default' | 'error' } {
  const run = bot.active_run;
  if (run?.status === 'running') return { label: t('status.started'), variant: 'success' };
  if (run?.status === 'queued') return { label: t('pages.telegram.starting'), variant: 'warning' };
  if (bot.status === 'disabled') return { label: t('status.stopped'), variant: 'default' };
  return { label: t('status.stopped'), variant: 'default' };
}

function botRunState(bot: TelegramBot): 'running' | 'queued' | 'stopped' {
  const run = bot.active_run?.status;
  if (run === 'running') return 'running';
  if (run === 'queued') return 'queued';
  return 'stopped';
}

function mergeTelegramBots(base: TelegramBot[], patch: TelegramBot): TelegramBot[] {
  if (base.length === 0) return base;
  const patchId = String(patch.id);
  const index = base.findIndex((bot) => String(bot.id) === patchId);
  if (index >= 0) {
    const next = [...base];
    next[index] = { ...next[index], ...patch };
    return next;
  }
  return [...base, patch];
}

function applyTelegramBotPatches(base: TelegramBot[], patches: Map<string, TelegramBot>): TelegramBot[] {
  let list = base;
  for (const patch of patches.values()) {
    list = mergeTelegramBots(list, patch);
  }
  return list;
}

export function TelegramPage() {
  const { t } = useLocale();
  const { showToast } = useToast();
  const [pageState, setPageState] = useState<PageState>('loading');
  const [serviceError, setServiceError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TelegramBot | null>(null);
  const [form, setForm] = useState<BotForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [botPatches, setBotPatches] = useState<Map<string, TelegramBot>>(() => new Map());
  const [qrBot, setQrBot] = useState<TelegramBot | null>(null);
  const [qrLink, setQrLink] = useState<TelegramBotLink | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);

  const checkService = useCallback(async () => {
    setPageState('loading');
    setServiceError(null);
    try {
      const health = await checkTelegramBridgeHealth();
      if (!health.ok) {
        throw new Error(health.error ?? t('telegram.errors.pyorchUnavailable'));
      }
      setPageState('ready');
    } catch (err) {
      setPageState('unavailable');
      const msg = err instanceof Error ? err.message : t('pages.telegram.serviceUnavailable');
      if (msg.includes('Failed to fetch') || msg.includes('502') || msg.includes('503')) {
        setServiceError(
          t('pages.telegram.pyorchDisabledHelp')
        );
      } else {
        setServiceError(msg);
      }
    }
  }, []);

  useEffect(() => {
    void checkService();
  }, [checkService]);

  const loadBots = useCallback(async () => {
    if (pageState !== 'ready') return [];
    return listTelegramBots();
  }, [pageState]);

  const {
    data: bots,
    loading: botsLoading,
    error: botsError,
    refresh,
  } = usePolling(loadBots, [pageState], {
    intervalMs: LIVE_INTERVAL_SLOW_MS,
    enabled: pageState === 'ready',
  });

  useEffect(() => {
    if (!bots) return;
    setBotPatches((prev) => {
      if (prev.size === 0) return prev;
      const next = new Map(prev);
      let changed = false;
      for (const id of prev.keys()) {
        if (bots.some((bot) => String(bot.id) === id)) {
          next.delete(id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [bots]);

  const rememberBot = useCallback((bot: TelegramBot) => {
    setBotPatches((prev) => new Map(prev).set(String(bot.id), bot));
  }, []);

  const forgetBot = useCallback((botId: string) => {
    const id = String(botId);
    setBotPatches((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (bot: TelegramBot) => {
    const botType = resolveBotType(bot);
    setEditing(bot);
    setForm({
      name: bot.name,
      token: '',
      botType,
      commands: bot.metadata.allowed_commands?.length
        ? [...bot.metadata.allowed_commands]
        : [...TELEGRAM_BOT_COMMAND_PRESETS[botType]],
      description: bot.description,
      startAfterCreate: false,
    });
    setFormError(null);
    setModalOpen(true);
  };

  const setBotType = (botType: TelegramBotType) => {
    setForm((prev) => ({
      ...prev,
      botType,
      commands: [...TELEGRAM_BOT_COMMAND_PRESETS[botType]],
    }));
  };

  const toggleCommand = (cmd: string) => {
    setForm((prev) => ({
      ...prev,
      commands: prev.commands.includes(cmd) ? prev.commands.filter((c) => c !== cmd) : [...prev.commands, cmd],
    }));
  };

  const handleSaveBot = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSaving(true);
    try {
      const tokenValue = form.token.trim();
      if (editing) {
        const needsToken = !editing.has_token;
        if (needsToken && !tokenValue) {
          setFormError(t('pages.telegram.tokenRequired'));
          return;
        }
        const updated = await updateTelegramBot(editing.id, {
          name: form.name,
          description: form.description,
          token: tokenValue || undefined,
          commands: form.commands,
          botType: form.botType,
        });
        rememberBot(updated);
        if (tokenValue) {
          showToast(t('pages.telegram.tokenSaved'), 'success');
        } else {
          showToast(t('api.saved'), 'success');
        }
      } else {
        if (!tokenValue) {
          setFormError(t('pages.telegram.tokenRequired'));
          return;
        }
        const created = await createTelegramBot({
          name: form.name,
          description: form.description,
          token: tokenValue,
          commands: form.commands,
          botType: form.botType,
          start: form.startAfterCreate,
        });
        rememberBot(created);
        showToast(t('api.saved'), 'success');
      }

      setModalOpen(false);
      await refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t('errors.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleStart = async (bot: TelegramBot) => {
    setActionId(bot.id);
    setStatusFilter('');
    try {
      const updated = await startTelegramBot(bot.id);
      rememberBot(updated);
      await refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : t('pages.telegram.startFailed'));
    } finally {
      setActionId(null);
    }
  };

  const handleStop = async (bot: TelegramBot) => {
    setActionId(bot.id);
    setStatusFilter('');
    try {
      const updated = await stopTelegramBot(bot.id);
      rememberBot(updated);
      await refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : t('pages.telegram.stopFailed'));
    } finally {
      setActionId(null);
    }
  };

  const handleDelete = async (bot: TelegramBot) => {
    if (!confirm(t('pages.telegram.confirmDeleteOne', { name: bot.name }))) return;
    setActionId(bot.id);
    try {
      await deleteTelegramBot(bot.id);
      forgetBot(bot.id);
      await refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : t('pages.telegram.deleteFailed'));
    } finally {
      setActionId(null);
    }
  };

  const openQrModal = async (bot: TelegramBot) => {
    setQrBot(bot);
    setQrLink(null);
    setQrError(null);
    setQrLoading(true);
    try {
      const link = await getTelegramBotLink(bot.id);
      setQrLink(link);
    } catch (err) {
      setQrError(err instanceof Error ? err.message : t('pages.telegram.qrFailed'));
    } finally {
      setQrLoading(false);
    }
  };

  const closeQrModal = () => {
    setQrBot(null);
    setQrLink(null);
    setQrError(null);
    setQrLoading(false);
  };

  const botList = useMemo(
    () => applyTelegramBotPatches(bots ?? [], botPatches),
    [bots, botPatches]
  );

  const bulkActions: DataTableBulkAction<TelegramBot>[] = useMemo(
    () => [
      createExportBulkAction('telegram-bots.csv', [
        { header: t('pages.telegram.name'), value: (bot) => bot.name },
        { header: t('pages.telegram.description'), value: (bot) => bot.description || '' },
        { header: t('pages.telegram.type'), value: (bot) => TELEGRAM_BOT_TYPE_LABELS[resolveBotType(bot)] },
        { header: t('common.status'), value: (bot) => runStatus(bot, t).label },
        {
          header: t('pages.telegram.commands'),
          value: (bot) => {
            const type = resolveBotType(bot);
            const cmds = bot.metadata.allowed_commands?.length
              ? bot.metadata.allowed_commands
              : TELEGRAM_BOT_COMMAND_PRESETS[type];
            return cmds.join(', ');
          },
        },
        { header: t('pages.telegram.createdAt'), value: (bot) => bot.created_at || '' },
      ]),
      {
        id: 'start',
        label: t('status.started'),
        variant: 'primary',
        disabled: (rows) => !rows.some((bot) => botRunState(bot) === 'stopped'),
        onAction: async (rows) => {
          const targets = rows.filter((bot) => botRunState(bot) === 'stopped');
          const errors: string[] = [];
          for (const bot of targets) {
            try {
              const updated = await startTelegramBot(bot.id);
              rememberBot(updated);
            } catch (err) {
              errors.push(`${bot.name}: ${err instanceof Error ? err.message : t('status.error')}`);
            }
          }
          await refresh();
          if (errors.length > 0) {
            throw new Error(
              t('pages.telegram.bulkStarted', {
                done: targets.length - errors.length,
                total: targets.length,
              }) + `.\n${errors.join('\n')}`
            );
          }
        },
      },
      {
        id: 'stop',
        label: t('status.stopped'),
        disabled: (rows) => !rows.some((bot) => botRunState(bot) === 'running' || botRunState(bot) === 'queued'),
        onAction: async (rows) => {
          const targets = rows.filter(
            (bot) => botRunState(bot) === 'running' || botRunState(bot) === 'queued'
          );
          const errors: string[] = [];
          for (const bot of targets) {
            try {
              const updated = await stopTelegramBot(bot.id);
              rememberBot(updated);
            } catch (err) {
              errors.push(`${bot.name}: ${err instanceof Error ? err.message : t('status.error')}`);
            }
          }
          await refresh();
          if (errors.length > 0) {
            throw new Error(
              t('pages.telegram.bulkStopped', {
                done: targets.length - errors.length,
                total: targets.length,
              }) + `.\n${errors.join('\n')}`
            );
          }
        },
      },
      {
        id: 'delete',
        label: t('common.delete'),
        variant: 'danger',
        confirmMessage: (_rows, ids) => t('pages.telegram.confirmDeleteMany', { count: ids.length }),
        onAction: async (rows) => {
          const errors: string[] = [];
          for (const bot of rows) {
            try {
              await deleteTelegramBot(bot.id);
              forgetBot(bot.id);
            } catch (err) {
              errors.push(`${bot.name}: ${err instanceof Error ? err.message : t('status.error')}`);
            }
          }
          await refresh();
          if (errors.length > 0) {
            throw new Error(
              t('pages.telegram.bulkDeleted', {
                done: rows.length - errors.length,
                total: rows.length,
              }) + `.\n${errors.join('\n')}`
            );
          }
        },
      },
    ],
    [forgetBot, rememberBot, refresh, t]
  );

  const filters: DataTableFilter<TelegramBot>[] = useMemo(
    () => [
      {
        id: 'status',
        label: t('common.status'),
        options: [
          { value: 'running', label: t('status.started') },
          { value: 'queued', label: t('pages.telegram.starting') },
          { value: 'stopped', label: t('status.stopped') },
        ],
        match: (bot, value) => botRunState(bot) === value,
      },
    ],
    [t]
  );

  const columns: DataTableColumn<TelegramBot>[] = useMemo(
    () => [
      {
        key: 'name',
        header: t('pages.telegram.bot'),
        sortable: true,
        sortValue: (bot) => bot.name,
        searchValue: (bot) => `${bot.name} ${bot.description || ''}`,
        render: (bot) => (
          <div>
            <div className="font-medium text-panel-ink dark:text-panel-ink-dark">{bot.name}</div>
            {bot.description && (
              <div className="text-xs text-panel-muted dark:text-panel-muted-dark">{bot.description}</div>
            )}
          </div>
        ),
      },
      {
        key: 'bot_type',
        header: t('pages.telegram.type'),
        sortable: true,
        sortValue: (bot) => resolveBotType(bot),
        render: (bot) => TELEGRAM_BOT_TYPE_LABELS[resolveBotType(bot)],
      },
      {
        key: 'status',
        header: t('common.status'),
        sortable: true,
        sortValue: (bot) => botRunState(bot),
        searchValue: (bot) => runStatus(bot, t).label,
        render: (bot) => {
          const st = runStatus(bot, t);
          return <Badge variant={st.variant}>{st.label}</Badge>;
        },
      },
      {
        key: 'commands',
        header: t('pages.telegram.commands'),
        sortable: true,
        sortValue: (bot) => {
          const type = resolveBotType(bot);
          const cmds = bot.metadata.allowed_commands?.length
            ? bot.metadata.allowed_commands
            : TELEGRAM_BOT_COMMAND_PRESETS[type];
          return cmds.join(',');
        },
        searchValue: (bot) => {
          const type = resolveBotType(bot);
          const cmds = bot.metadata.allowed_commands?.length
            ? bot.metadata.allowed_commands
            : TELEGRAM_BOT_COMMAND_PRESETS[type];
          return cmds.join(' ');
        },
        render: (bot) => {
          const type = resolveBotType(bot);
          const cmds = bot.metadata.allowed_commands?.length
            ? bot.metadata.allowed_commands
            : [...TELEGRAM_BOT_COMMAND_PRESETS[type]];
          return (
            <div className="flex flex-wrap gap-1">
              {cmds.slice(0, 4).map((c) => (
                <span
                  key={c}
                  className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                >
                  {c}
                </span>
              ))}
              {cmds.length > 4 && <span className="text-[10px] text-panel-muted">+{cmds.length - 4}</span>}
            </div>
          );
        },
      },
      {
        key: 'created_at',
        header: t('pages.telegram.createdAt'),
        sortable: true,
        sortValue: (bot) => bot.created_at || '',
        render: (bot) => formatDateTime(bot.created_at),
      },
      {
        key: 'actions',
        header: '',
        render: (bot) => {
          const running = bot.active_run?.status === 'running' || bot.active_run?.status === 'queued';
          const busy = actionId === bot.id;
          return (
            <div className="flex justify-end gap-1">
              {!running ? (
                <button
                  type="button"
                  className="btn-icon text-emerald-600"
                  title={t('status.started')}
                  disabled={busy}
                  onClick={() => void handleStart(bot)}
                >
                  <Play size={16} />
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-icon text-amber-600"
                  title={t('status.stopped')}
                  disabled={busy}
                  onClick={() => void handleStop(bot)}
                >
                  <Square size={16} />
                </button>
              )}
              <button
                type="button"
                className="btn-icon"
                title={t('pages.telegram.qrTitle')}
                disabled={busy}
                onClick={() => void openQrModal(bot)}
              >
                <QrCode size={16} />
              </button>
              <button type="button" className="btn-icon" title={t('nav.items.settings')} onClick={() => openEdit(bot)}>
                <Pencil size={16} />
              </button>
              <button
                type="button"
                className="btn-icon text-red-500"
                title={t('common.delete')}
                disabled={busy}
                onClick={() => void handleDelete(bot)}
              >
                <Trash2 size={16} />
              </button>
            </div>
          );
        },
      },
    ],
    [actionId, t]
  );

  if (pageState === 'loading') {
    return (
      <div>
        <PageHeader title={t('nav.items.telegram')} subtitle={t('pages.telegram.subtitleShort')} />
        <Loading />
      </div>
    );
  }

  if (pageState === 'unavailable') {
    return (
      <div>
        <PageHeader title={t('nav.items.telegram')} subtitle={t('pages.telegram.subtitleShort')} />
        <div className="card max-w-xl space-y-4">
          <ErrorMessage message={serviceError ?? t('pages.telegram.serviceUnavailable')} />
          <button type="button" className="btn-secondary inline-flex items-center gap-2" onClick={() => void checkService()}>
            <RefreshCw size={16} />
            {t('common.refresh')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={t('nav.items.telegram')}
        subtitle={t('pages.telegram.subtitle')}
        actions={
          <button type="button" className="btn-primary" onClick={openCreate}>
            <Plus size={16} className="mr-1.5 inline" />
            {t('pages.telegram.createBot')}
          </button>
        }
      />

      {botsError && (
        <div className="mb-4">
          <ErrorMessage message={botsError} />
        </div>
      )}

      {botsLoading && botList.length === 0 ? (
        <Loading />
      ) : botList.length === 0 ? (
        <div className="card">
          <Empty message={t('pages.telegram.empty')} />
          <div className="mt-4 flex justify-center pb-4">
            <button type="button" className="btn-primary" onClick={openCreate}>
              <Plus size={16} className="mr-1.5 inline" />
              {t('pages.telegram.createFirst')}
            </button>
          </div>
        </div>
      ) : (
        <DataTable
          tableId="telegram-bots"
          columns={columns}
          data={botList}
          rowKey={(bot) => bot.id}
          filters={filters}
          filterValues={{ status: statusFilter }}
          onFilterChange={(id, value) => {
            if (id === 'status') setStatusFilter(value);
          }}
          searchPlaceholder={t('pages.telegram.searchPlaceholder')}
          bulkActions={bulkActions}
          emptyMessage={
            botList.length > 0 && statusFilter
              ? t('pages.telegram.noBotsByStatus')
              : t('pages.telegram.empty')
          }
        />
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? t('pages.telegram.editBot') : t('pages.telegram.newBot')}
      >
        <form onSubmit={handleSaveBot} className="space-y-4">
          {formError && <ErrorMessage message={formError} />}

          <div>
            <label className="label">{t('pages.telegram.name')}</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={t('pages.telegram.namePlaceholder')}
              required
            />
          </div>

          <div>
            <label className="label">{t('pages.telegram.description')}</label>
            <input
              className="input"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder={t('pages.groups.optional')}
            />
          </div>

          <div>
            <label className="label">{t('pages.telegram.type')}</label>
            <select
              className="input"
              value={form.botType}
              onChange={(e) => setBotType(e.target.value as TelegramBotType)}
            >
              {TELEGRAM_BOT_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-panel-muted dark:text-panel-muted-dark">
              {TELEGRAM_BOT_TYPE_OPTIONS.find((o) => o.value === form.botType)?.hint}
            </p>
          </div>

          <div>
            <label className="label">
              Token{editing?.has_token ? ` ${t('pages.telegram.tokenEditHint')}` : ''}
            </label>
            {editing && (
              <p
                className={`mb-1.5 text-xs ${
                  editing.has_token
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-amber-700 dark:text-amber-400'
                }`}
              >
                {editing.has_token
                  ? t('pages.telegram.tokenConfigured')
                  : t('pages.telegram.tokenMissing')}
              </p>
            )}
            <PasswordInput
              className="font-mono text-xs"
              value={form.token}
              onChange={(e) => setForm({ ...form, token: e.target.value })}
              placeholder="123456789:ABCdefGHI..."
              autoComplete="off"
              required={!editing || !editing.has_token}
            />
          </div>

          {form.botType === 'informational' ? (
            <div className="rounded-lg border border-panel-border p-3 text-sm dark:border-panel-border-dark">
              <p className="font-medium text-panel-ink dark:text-panel-ink-dark">{t('pages.telegram.infoBotMenu')}</p>
              <p className="mt-1 text-xs text-panel-muted dark:text-panel-muted-dark">
                {t('pages.telegram.infoBotHintStart')}{' '}
                <Link to="/info-messages" className="text-brand-600 hover:underline dark:text-brand-400">
                  {t('nav.items.infoMessages')}
                </Link>
                .
              </p>
            </div>
          ) : (
            <div>
              <label className="label mb-2">{t('pages.telegram.allowedCommands')}</label>
              <div className="space-y-3">
                {WASH_TELEGRAM_COMMAND_GROUPS.map((group) => (
                  <div key={group.label}>
                    <p className="mb-1 text-xs font-medium text-panel-muted dark:text-panel-muted-dark">{group.label}</p>
                    <div className="flex flex-wrap gap-2">
                      {group.commands.map((cmd) => (
                        <label
                          key={cmd}
                          className="flex items-center gap-1 rounded-lg border border-panel-border px-3 py-1.5 text-sm dark:border-panel-border-dark"
                        >
                          <input type="checkbox" checked={form.commands.includes(cmd)} onChange={() => toggleCommand(cmd)} />
                          {cmd}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!editing && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.startAfterCreate}
                onChange={(e) => setForm({ ...form, startAfterCreate: e.target.checked })}
              />
              {t('pages.telegram.startAfterCreate')}
            </label>
          )}

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>
              {t('common.cancel')}
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? t('common.saving') : editing ? t('common.save') : t('pages.telegram.createBot')}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(qrBot)}
        onClose={closeQrModal}
        title={qrBot ? t('pages.telegram.botLinkWithName', { name: qrBot.name }) : t('pages.telegram.botLink')}
      >
        {qrLoading && <Loading />}
        {qrError && <ErrorMessage message={qrError} />}
        {qrLink && (
          <div className="space-y-4">
            <div className="flex justify-center">
              <img
                src={qrLink.qrUrl}
                alt={t('pages.telegram.qrAlt', { username: qrLink.username })}
                className="h-52 w-52 rounded-lg border border-panel-border bg-white p-2 dark:border-panel-border-dark"
              />
            </div>
            <div className="space-y-2 text-sm">
              <div className="text-panel-muted dark:text-panel-muted-dark">{t('pages.telegram.clientLink')}</div>
              <a
                href={qrLink.url}
                target="_blank"
                rel="noreferrer"
                className="block break-all font-mono text-brand-600 hover:underline dark:text-brand-400"
              >
                {qrLink.url}
              </a>
              {qrLink.username && (
                <div className="text-panel-muted dark:text-panel-muted-dark">
                  Telegram: <span className="font-mono text-panel-ink dark:text-panel-ink-dark">@{qrLink.username}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
