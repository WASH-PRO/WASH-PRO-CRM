import {
  channelsFromSettings,
  DEFAULT_NOTIFICATION_SETTINGS,
  isNotificationTypeEnabled,
  normalizeNotificationSettings,
} from './settings.js';

export interface NotifyPayload {
  type: string;
  severity: 'info' | 'warning' | 'error';
  message: string;
  washId?: string;
  postId?: string;
}

export async function createCrmNotification(
  apiUrl: string,
  token: string,
  payload: NotifyPayload
): Promise<void> {
  let settings = DEFAULT_NOTIFICATION_SETTINGS;
  try {
    const settingsRes = await fetch(`${apiUrl}/api/crm/settings`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const settingsJson = (await settingsRes.json()) as {
      success: boolean;
      data?: Array<{ key: string; value: unknown }>;
    };
    const row = settingsJson.data?.find((s) => s.key === 'notifications');
    if (row) settings = normalizeNotificationSettings(row.value);
  } catch {
    // defaults
  }

  if (!isNotificationTypeEnabled(payload.type, settings)) return;

  const channels = channelsFromSettings(settings);
  if (!channels.length) return;

  await fetch(`${apiUrl}/api/crm/notifications`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      ...payload,
      read: false,
      channels,
      createdAt: new Date().toISOString(),
    }),
  });
}
