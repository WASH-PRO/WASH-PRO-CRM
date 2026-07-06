import { apiRequest, findPostBySerial } from './api-client.js';
import { parseInboundPrices } from './post-device.js';

function refId(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'object') {
    const obj = value as { id?: string; _id?: string };
    return String(obj.id ?? obj._id ?? '');
  }
  return String(value);
}

export async function mergePostSettings(
  serial: string,
  patch: Record<string, unknown>
): Promise<void> {
  const post = await findPostBySerial(serial);
  if (!post) throw new Error('Пост не найден');

  const full = await apiRequest<{
    id: string;
    washId: unknown;
    postNumber: number;
    name: string;
    serialNumber: string;
    settings?: Record<string, unknown>;
  }>('GET', `/api/crm/posts/${post.id}`);

  const settings = {
    ...(full.settings && typeof full.settings === 'object' ? full.settings : {}),
    ...patch,
  };

  await apiRequest('PUT', `/api/crm/posts/${post.id}`, {
    washId: refId(full.washId),
    postNumber: full.postNumber,
    name: full.name,
    serialNumber: full.serialNumber,
    settings,
  });
}

export async function syncPricesFromDevice(
  postSerial: string,
  payload: Record<string, unknown>
): Promise<void> {
  if (payload.direction === 'outbound') return;

  const modePrices = parseInboundPrices(payload);
  if (!Object.keys(modePrices).length) return;
  await mergePostSettings(postSerial, {
    modePrices,
    pricesSyncedAt: new Date().toISOString(),
  });
}
