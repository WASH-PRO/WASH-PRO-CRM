import { execFile } from 'node:child_process';
import { chmod } from 'node:fs/promises';
import { promisify } from 'node:util';
import { apiRequest, logger } from './api-client.js';

const execFileAsync = promisify(execFile);

interface PostRow {
  id: string;
  serialNumber?: string;
  settings?: {
    mqttLogin?: string;
    mqttPassword?: string;
  };
}

/** Пересобирает passwd Mosquitto: сервисный аккаунт CRM + учётные записи постов. */
export async function syncMqttUsersFromPosts(): Promise<{ postUsers: number }> {
  const passwdFile = process.env.MQTT_PASSWD_FILE;
  if (!passwdFile) {
    logger.warn('MQTT_PASSWD_FILE is not set — MQTT user sync skipped');
    return { postUsers: 0 };
  }

  const crmUser = process.env.MQTT_USER || 'wash';
  const crmPass = process.env.MQTT_PASSWORD || 'wash_secret_change_me';

  const posts = await apiRequest<PostRow[]>('GET', '/api/crm/posts?limit=500');
  const postUsers = new Map<string, string>();

  for (const post of posts) {
    const login = post.settings?.mqttLogin?.trim();
    const password = post.settings?.mqttPassword?.trim();
    if (!login || !password) continue;
    if (login === crmUser) {
      logger.warn({ postId: post.id, serial: post.serialNumber }, 'Post MQTT login conflicts with service user — skipped');
      continue;
    }
    if (postUsers.has(login)) {
      logger.warn({ login, postId: post.id }, 'Duplicate MQTT login — last post wins');
    }
    postUsers.set(login, password);
  }

  await execFileAsync('mosquitto_passwd', ['-b', '-c', passwdFile, crmUser, crmPass]);
  for (const [login, password] of postUsers) {
    await execFileAsync('mosquitto_passwd', ['-b', passwdFile, login, password]);
  }
  await chmod(passwdFile, 0o644);

  logger.info({ serviceUser: crmUser, postUsers: postUsers.size }, 'MQTT passwd file synced');
  return { postUsers: postUsers.size };
}
