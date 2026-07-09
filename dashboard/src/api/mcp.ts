export interface McpTool {
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
}

export interface PyorchMcpTool {
  name: string;
  category: string;
  description: string;
}

export const PYORCH_MCP_TOOLS: PyorchMcpTool[] = [
  { name: 'pyorch_login', category: 'auth', description: 'Получить JWT для API PyOrchestrator' },
  { name: 'pyorch_whoami', category: 'auth', description: 'Текущий пользователь и права' },
  { name: 'list_scripts', category: 'scripts', description: 'Список скриптов (ботов, задач)' },
  { name: 'get_script', category: 'scripts', description: 'Метаданные и файлы скрипта' },
  { name: 'create_script', category: 'scripts', description: 'Создать скрипт' },
  { name: 'update_script_file', category: 'scripts', description: 'Обновить файл скрипта' },
  { name: 'enable_script', category: 'scripts', description: 'Включить выполнение' },
  { name: 'disable_script', category: 'scripts', description: 'Отключить выполнение' },
  { name: 'delete_script', category: 'scripts', description: 'Удалить скрипт' },
  { name: 'run_script', category: 'runs', description: 'Запустить скрипт' },
  { name: 'stop_script', category: 'runs', description: 'Остановить запущенные sandbox' },
  { name: 'get_run', category: 'runs', description: 'Статус запуска' },
  { name: 'get_run_logs', category: 'runs', description: 'Логи запуска' },
  { name: 'list_script_runs', category: 'runs', description: 'История запусков скрипта' },
  { name: 'list_groups', category: 'organization', description: 'Группы скриптов' },
  { name: 'list_schedules', category: 'automation', description: 'Расписания cron/interval' },
  { name: 'create_schedule', category: 'automation', description: 'Создать расписание' },
  { name: 'list_webhooks', category: 'automation', description: 'Входящие webhooks' },
  { name: 'create_webhook', category: 'automation', description: 'Создать webhook' },
  { name: 'set_script_secret', category: 'secrets', description: 'Зашифрованный секрет скрипта' },
  { name: 'list_script_secrets', category: 'secrets', description: 'Ключи секретов скрипта' },
  { name: 'dashboard_stats', category: 'platform', description: 'KPI платформы' },
  { name: 'system_info', category: 'platform', description: 'Состояние платформы' },
  { name: 'list_notifications', category: 'platform', description: 'Уведомления пользователя' },
];

export async function getDapMcpTools(signal?: AbortSignal): Promise<McpTool[]> {
  const json = await fetch('/api/mcp/tools', {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('wash_crm_token') || ''}`,
    },
    signal,
  });
  if (!json.ok) throw new Error(`Dynamic API MCP: HTTP ${json.status}`);
  const body = (await json.json()) as { success?: boolean; data?: McpTool[]; error?: string };
  if (!body.success) throw new Error(body.error || 'Не удалось загрузить инструменты');
  return body.data ?? [];
}

export async function checkPyorchMcpReachable(signal?: AbortSignal): Promise<boolean> {
  try {
    const res = await fetch('/api/pyorch-mcp/mcp', {
      method: 'GET',
      signal,
      cache: 'no-store',
    });
    return res.status === 200 || res.status === 405 || res.status === 406;
  } catch {
    return false;
  }
}
