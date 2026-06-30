const PERMISSION_KEY_MAP: Record<string, string> = {
  "scripts:read": "permissions.scripts_read",
  "scripts:write": "permissions.scripts_write",
  "scripts:run": "permissions.scripts_run",
  "scripts:delete": "permissions.scripts_delete",
  "scripts:disable": "permissions.scripts_disable",
  "secrets:write": "permissions.secrets_write",
  "groups:read": "permissions.groups_read",
  "schedules:read": "permissions.schedules_read",
  "schedules:write": "permissions.schedules_write",
  "webhooks:read": "permissions.webhooks_read",
  "webhooks:write": "permissions.webhooks_write",
  "runs:read": "permissions.runs_read",
};

export function permissionLabel(t: (key: string) => string, perm: string): string {
  const key = PERMISSION_KEY_MAP[perm];
  return key ? t(key) : perm;
}
