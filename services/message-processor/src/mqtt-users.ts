import { execFile } from 'node:child_process';
import { chmod, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { apiRequest, logger } from './api-client.js';
import { buildMqttAclFile } from './mqtt-acl.js';
import { setMqttPostBindings, type MqttPostBinding } from './mqtt-post-bindings.js';
import { sanitizeSerial } from './post-device.js';

const execFileAsync = promisify(execFile);

interface PostRow {
  id: string;
  serialNumber?: string;
  settings?: {
    mqttLogin?: string;
    mqttPassword?: string;
  };
}

const RESERVED_MQTT_LOGINS = new Set(['superadmin', 'wash']);

/** Пересобирает passwd Mosquitto: superadmin (CRM) + учётные записи постов. */
export async function syncMqttUsersFromPosts(): Promise<{ postUsers: number }> {
  const passwdFile = process.env.MQTT_PASSWD_FILE;
  if (!passwdFile) {
    logger.warn('MQTT_PASSWD_FILE is not set — MQTT user sync skipped');
    return { postUsers: 0 };
  }

  const crmUser = process.env.MQTT_USER || 'superadmin';
  const crmPass = process.env.MQTT_PASSWORD;
  if (!crmPass) {
    logger.warn('MQTT_PASSWORD is not set — MQTT user sync skipped');
    return { postUsers: 0 };
  }

  const posts = await apiRequest<PostRow[]>('GET', '/api/crm/posts?limit=500');
  const postUsers = new Map<string, string>();
  const aclPosts: Array<{ mqttLogin: string; serialNumber: string }> = [];
  const bindings: MqttPostBinding[] = [];

  for (const post of posts) {
    const login = post.settings?.mqttLogin?.trim();
    const password = post.settings?.mqttPassword?.trim();
    const serial = sanitizeSerial(post.serialNumber || '');
    if (!login || !password || !serial) continue;
    if (login === crmUser || RESERVED_MQTT_LOGINS.has(login)) {
      logger.warn({ postId: post.id, serial: post.serialNumber, login }, 'Post MQTT login is reserved — skipped');
      continue;
    }
    if (postUsers.has(login)) {
      logger.warn({ login, postId: post.id }, 'Duplicate MQTT login — skipped');
      continue;
    }
    postUsers.set(login, password);
    aclPosts.push({ mqttLogin: login, serialNumber: serial });
    bindings.push({ postId: post.id, serialNumber: serial, mqttLogin: login });
  }

  const aclFile = process.env.MQTT_ACL_FILE;
  const devicePrefix = process.env.MQTT_DEVICE_PREFIX || 'washpro';
  if (aclFile) {
    const aclBody = buildMqttAclFile(crmUser, aclPosts, devicePrefix);
    await writeFile(aclFile, aclBody, 'utf8');
    await chmod(aclFile, 0o600);
  } else {
    logger.warn('MQTT_ACL_FILE is not set — MQTT ACL sync skipped');
  }

  setMqttPostBindings(bindings);

  await execFileAsync('mosquitto_passwd', ['-b', '-c', passwdFile, crmUser, crmPass]);
  for (const [login, password] of postUsers) {
    await execFileAsync('mosquitto_passwd', ['-b', passwdFile, login, password]);
  }
  await chmod(passwdFile, 0o600);

  logger.info({ serviceUser: crmUser, postUsers: postUsers.size }, 'MQTT passwd file synced');
  return { postUsers: postUsers.size };
}
