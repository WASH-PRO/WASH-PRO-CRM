import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Pencil, Play, Plus, RefreshCw, Square, Trash2 } from 'lucide-react';
import {
  WASH_TELEGRAM_COMMAND_GROUPS,
  WASH_TELEGRAM_COMMANDS,
  checkTelegramBridgeHealth,
  createTelegramBot,
  deleteTelegramBot,
  listTelegramBots,
  startTelegramBot,
  stopTelegramBot,
  updateTelegramBot,
  type TelegramBot,
} from '../api/telegramBots';
import { Badge, Empty, ErrorMessage, Loading, Modal, PageHeader } from '../components/UI';
import { DataTable, type DataTableColumn, type DataTableFilter } from '../components/DataTable';
import { LIVE_INTERVAL_SLOW_MS } from '../constants/live';
import { usePolling } from '../hooks/usePolling';
import { formatDateTime } from '../utils/format';

interface BotForm {
  name: string;
  token: string;
  adminIds: string;
  commands: string[];
  description: string;
  startAfterCreate: boolean;
}

const EMPTY_FORM: BotForm = {
  name: '',
  token: '',
  adminIds: '',
  commands: [...WASH_TELEGRAM_COMMANDS],
  description: '',
  startAfterCreate: true,
};

type PageState = 'loading' | 'ready' | 'unavailable';

function runStatus(bot: TelegramBot): { label: string; variant: 'success' | 'warning' | 'default' | 'error' } {
  const run = bot.active_run;
  if (run?.status === 'running') return { label: 'Запущен', variant: 'success' };
  if (run?.status === 'queued') return { label: 'Запуск…', variant: 'warning' };
  if (bot.status === 'disabled') return { label: 'Остановлен', variant: 'default' };
  return { label: 'Остановлен', variant: 'default' };
}

function botRunState(bot: TelegramBot): 'running' | 'queued' | 'stopped' {
  const run = bot.active_run?.status;
  if (run === 'running') return 'running';
  if (run === 'queued') return 'queued';
  return 'stopped';
}

export function TelegramPage() {
  const [pageState, setPageState] = useState<PageState>('loading');
  const [serviceError, setServiceError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TelegramBot | null>(null);
  const [form, setForm] = useState<BotForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const checkService = useCallback(async () => {
    setPageState('loading');
    setServiceError(null);
    try {
      const health = await checkTelegramBridgeHealth();
      if (!health.ok) {
        throw new Error(health.error ?? 'PyOrchestrator недоступен');
      }
      setPageState('ready');
    } catch (err) {
      setPageState('unavailable');
      const msg = err instanceof Error ? err.message : 'Сервис недоступен';
      if (msg.includes('Failed to fetch') || msg.includes('502') || msg.includes('503')) {
        setServiceError(
          'PyOrchestrator не запущен. Убедитесь, что в .env стоит PYORCHESTRATOR_ENABLED=true, затем выполните: ./scripts/start.sh'
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

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (bot: TelegramBot) => {
    setEditing(bot);
    setForm({
      name: bot.name,
      token: '',
      adminIds: (bot.metadata.admin_ids ?? []).join(', '),
      commands: bot.metadata.allowed_commands?.length
        ? [...bot.metadata.allowed_commands]
        : [...WASH_TELEGRAM_COMMANDS],
      description: bot.description,
      startAfterCreate: false,
    });
    setFormError(null);
    setModalOpen(true);
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
      const adminIds = form.adminIds
        .split(',')
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !Number.isNaN(n));

      if (editing) {
        await updateTelegramBot(editing.id, {
          name: form.name,
          description: form.description,
          token: form.token.trim() || undefined,
          adminIds,
          commands: form.commands,
        });
      } else {
        if (!form.token.trim()) {
          setFormError('Укажите токен бота от @BotFather');
          return;
        }
        if (!adminIds.length) {
          setFormError('Укажите хотя бы один Telegram ID администратора');
          return;
        }
        await createTelegramBot({
          name: form.name,
          description: form.description,
          token: form.token.trim(),
          adminIds,
          commands: form.commands,
          start: form.startAfterCreate,
        });
      }

      setModalOpen(false);
      await refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const handleStart = async (bot: TelegramBot) => {
    setActionId(bot.id);
    try {
      await startTelegramBot(bot.id);
      await refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Не удалось запустить');
    } finally {
      setActionId(null);
    }
  };

  const handleStop = async (bot: TelegramBot) => {
    setActionId(bot.id);
    try {
      await stopTelegramBot(bot.id);
      await refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Не удалось остановить');
    } finally {
      setActionId(null);
    }
  };

  const handleDelete = async (bot: TelegramBot) => {
    if (!confirm(`Удалить бота «${bot.name}»?`)) return;
    setActionId(bot.id);
    try {
      await deleteTelegramBot(bot.id);
      await refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Не удалось удалить');
    } finally {
      setActionId(null);
    }
  };

  const botList = bots ?? [];

  const filters: DataTableFilter<TelegramBot>[] = useMemo(
    () => [
      {
        id: 'status',
        label: 'Статус',
        options: [
          { value: 'running', label: 'Запущен' },
          { value: 'queued', label: 'Запуск…' },
          { value: 'stopped', label: 'Остановлен' },
        ],
        match: (bot, value) => botRunState(bot) === value,
      },
    ],
    []
  );

  const columns: DataTableColumn<TelegramBot>[] = useMemo(
    () => [
      {
        key: 'name',
        header: 'Бот',
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
        key: 'status',
        header: 'Статус',
        sortable: true,
        sortValue: (bot) => botRunState(bot),
        searchValue: (bot) => runStatus(bot).label,
        render: (bot) => {
          const st = runStatus(bot);
          return <Badge variant={st.variant}>{st.label}</Badge>;
        },
      },
      {
        key: 'commands',
        header: 'Команды',
        sortable: true,
        sortValue: (bot) =>
          (bot.metadata.allowed_commands?.length ? bot.metadata.allowed_commands : WASH_TELEGRAM_COMMANDS).join(','),
        searchValue: (bot) =>
          (bot.metadata.allowed_commands?.length ? bot.metadata.allowed_commands : WASH_TELEGRAM_COMMANDS).join(' '),
        render: (bot) => {
          const cmds = bot.metadata.allowed_commands?.length
            ? bot.metadata.allowed_commands
            : [...WASH_TELEGRAM_COMMANDS];
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
        header: 'Дата создания',
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
                  title="Запустить"
                  disabled={busy}
                  onClick={() => void handleStart(bot)}
                >
                  <Play size={16} />
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-icon text-amber-600"
                  title="Остановить"
                  disabled={busy}
                  onClick={() => void handleStop(bot)}
                >
                  <Square size={16} />
                </button>
              )}
              <button type="button" className="btn-icon" title="Настройки" onClick={() => openEdit(bot)}>
                <Pencil size={16} />
              </button>
              <button
                type="button"
                className="btn-icon text-red-500"
                title="Удалить"
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
    [actionId]
  );

  if (pageState === 'loading') {
    return (
      <div>
        <PageHeader title="Telegram боты" subtitle="Создание и управление ботами из WASH PRO" />
        <Loading />
      </div>
    );
  }

  if (pageState === 'unavailable') {
    return (
      <div>
        <PageHeader title="Telegram боты" subtitle="Создание и управление ботами из WASH PRO" />
        <div className="card max-w-xl space-y-4">
          <ErrorMessage message={serviceError ?? 'Сервис Telegram-ботов недоступен'} />
          <button type="button" className="btn-secondary inline-flex items-center gap-2" onClick={() => void checkService()}>
            <RefreshCw size={16} />
            Повторить
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Telegram боты"
        subtitle="Создавайте несколько ботов, настраивайте команды и управляйте ими прямо здесь"
        actions={
          <button type="button" className="btn-primary" onClick={openCreate}>
            <Plus size={16} className="mr-1.5 inline" />
            Создать бота
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
          <Empty message="Telegram-ботов пока нет" />
          <div className="mt-4 flex justify-center pb-4">
            <button type="button" className="btn-primary" onClick={openCreate}>
              <Plus size={16} className="mr-1.5 inline" />
              Создать первого бота
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
          searchPlaceholder="Поиск ботов…"
          emptyMessage="Telegram-ботов пока нет"
        />
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Настройки бота' : 'Новый Telegram-бот'}
      >
        <form onSubmit={handleSaveBot} className="space-y-4">
          {formError && <ErrorMessage message={formError} />}

          <div>
            <label className="label">Название</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Бот для мойки на Ленина"
              required
            />
          </div>

          <div>
            <label className="label">Описание</label>
            <input
              className="input"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Необязательно"
            />
          </div>

          <div>
            <label className="label">Token {editing ? '(оставьте пустым, чтобы не менять)' : ''}</label>
            <input
              className="input font-mono text-xs"
              value={form.token}
              onChange={(e) => setForm({ ...form, token: e.target.value })}
              placeholder="123456789:ABCdefGHI..."
              required={!editing}
            />
          </div>

          <div>
            <label className="label">ID администраторов Telegram (через запятую)</label>
            <input
              className="input"
              value={form.adminIds}
              onChange={(e) => setForm({ ...form, adminIds: e.target.value })}
              placeholder="123456789, 987654321"
              required
            />
          </div>

          <div>
            <label className="label mb-2">Разрешённые команды</label>
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

          {!editing && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.startAfterCreate}
                onChange={(e) => setForm({ ...form, startAfterCreate: e.target.checked })}
              />
              Запустить сразу после создания
            </label>
          )}

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>
              Отмена
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Сохранение…' : editing ? 'Сохранить' : 'Создать бота'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
