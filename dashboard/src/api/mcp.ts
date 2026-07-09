import { tGlobal } from '../i18n/runtime';

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
  { name: 'pyorch_login', category: 'auth', description: tGlobal('mcp.tools.pyorchLogin') },
  { name: 'pyorch_whoami', category: 'auth', description: tGlobal('mcp.tools.pyorchWhoami') },
  { name: 'list_scripts', category: 'scripts', description: tGlobal('mcp.tools.listScripts') },
  { name: 'get_script', category: 'scripts', description: tGlobal('mcp.tools.getScript') },
  { name: 'create_script', category: 'scripts', description: tGlobal('mcp.tools.createScript') },
  { name: 'update_script_file', category: 'scripts', description: tGlobal('mcp.tools.updateScriptFile') },
  { name: 'enable_script', category: 'scripts', description: tGlobal('mcp.tools.enableScript') },
  { name: 'disable_script', category: 'scripts', description: tGlobal('mcp.tools.disableScript') },
  { name: 'delete_script', category: 'scripts', description: tGlobal('mcp.tools.deleteScript') },
  { name: 'run_script', category: 'runs', description: tGlobal('mcp.tools.runScript') },
  { name: 'stop_script', category: 'runs', description: tGlobal('mcp.tools.stopScript') },
  { name: 'get_run', category: 'runs', description: tGlobal('mcp.tools.getRun') },
  { name: 'get_run_logs', category: 'runs', description: tGlobal('mcp.tools.getRunLogs') },
  { name: 'list_script_runs', category: 'runs', description: tGlobal('mcp.tools.listScriptRuns') },
  { name: 'list_groups', category: 'organization', description: tGlobal('mcp.tools.listGroups') },
  { name: 'list_schedules', category: 'automation', description: tGlobal('mcp.tools.listSchedules') },
  { name: 'create_schedule', category: 'automation', description: tGlobal('mcp.tools.createSchedule') },
  { name: 'list_webhooks', category: 'automation', description: tGlobal('mcp.tools.listWebhooks') },
  { name: 'create_webhook', category: 'automation', description: tGlobal('mcp.tools.createWebhook') },
  { name: 'set_script_secret', category: 'secrets', description: tGlobal('mcp.tools.setScriptSecret') },
  { name: 'list_script_secrets', category: 'secrets', description: tGlobal('mcp.tools.listScriptSecrets') },
  { name: 'dashboard_stats', category: 'platform', description: tGlobal('mcp.tools.dashboardStats') },
  { name: 'system_info', category: 'platform', description: tGlobal('mcp.tools.systemInfo') },
  { name: 'list_notifications', category: 'platform', description: tGlobal('mcp.tools.listNotifications') },
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
  if (!body.success) throw new Error(body.error || tGlobal('mcp.loadToolsFailed'));
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
