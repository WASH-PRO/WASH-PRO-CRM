export interface CrmMcpConfig {
  apiUrl: string;
  dashboardUrl: string;
  login: string;
  password: string;
  token: string;
  refreshToken: string;
  apiKey: string;
  serverName: string;
  serverVersion: string;
}

function trim(value: string | undefined): string {
  return value?.trim() || '';
}

export function loadConfig(): CrmMcpConfig {
  const apiUrl = trim(process.env.CRM_API_URL) || 'http://localhost:3001';
  const dashboardUrl = trim(process.env.CRM_DASHBOARD_URL) || trim(process.env.CRM_API_URL) || 'http://localhost';

  return {
    apiUrl: apiUrl.replace(/\/+$/, ''),
    dashboardUrl: dashboardUrl.replace(/\/+$/, ''),
    login: trim(process.env.CRM_LOGIN),
    password: trim(process.env.CRM_PASSWORD),
    token: trim(process.env.CRM_TOKEN),
    refreshToken: trim(process.env.CRM_REFRESH_TOKEN),
    apiKey: trim(process.env.CRM_API_KEY),
    serverName: trim(process.env.MCP_SERVER_NAME) || 'wash-pro-crm',
    serverVersion: trim(process.env.MCP_SERVER_VERSION) || '1.0.0',
  };
}
