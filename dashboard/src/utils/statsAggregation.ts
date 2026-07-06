import { refId, resolveWashAddress, UNDEFINED_WASH_LABEL } from './refs';
import type { FinanceStat, Post, PostIdRef, UsageStat, Wash, WashRef } from '../types';

import { POST_ONLINE_THRESHOLD_MS } from '../constants/live';

function recordTime(item: { recordedAt?: string; lastMessageAt?: string; createdAt?: string }): number {
  const raw = item.recordedAt ?? item.lastMessageAt ?? item.createdAt;
  if (!raw) return 0;
  const t = new Date(raw).getTime();
  return Number.isNaN(t) ? 0 : t;
}

/** Последняя запись на каждый пост и период (финансы). */
export function latestFinanceByPost(stats: FinanceStat[]): FinanceStat[] {
  const byKey = new Map<string, FinanceStat>();
  for (const row of stats) {
    const postKey = refId(row.postId) || row.id;
    const key = `${postKey}:${row.period || 'before_collection'}`;
    const prev = byKey.get(key);
    if (!prev || recordTime(row) >= recordTime(prev)) {
      byKey.set(key, row);
    }
  }
  return [...byKey.values()];
}

/** Последняя запись на каждый пост, период и категорию (использование). */
export function latestUsageByPostAndCategory(stats: UsageStat[]): UsageStat[] {
  const byKey = new Map<string, UsageStat>();
  for (const row of stats) {
    const postKey = refId(row.postId) || row.id;
    const key = `${postKey}:${row.period || 'before_collection'}:${row.category}`;
    const prev = byKey.get(key);
    if (!prev || recordTime(row) >= recordTime(prev)) {
      byKey.set(key, row);
    }
  }
  return [...byKey.values()];
}

/** Последняя запись на каждый пост (состояние). */
export function latestPostStateByPost(states: Array<{
  id: string;
  postId?: PostIdRef | string;
  recordedAt?: string;
  lastMessageAt?: string;
  createdAt?: string;
  washId?: WashRef | string;
  mode?: string;
  modeName?: string;
  modeNumber?: number;
  freePause?: number;
  paidPause?: number;
  balance?: number;
  discount?: number;
  modeTime?: number;
  equipmentState?: Record<string, unknown>;
  connected?: boolean;
}>) {
  const byPost = new Map<string, typeof states[0]>();
  for (const row of states) {
    const postKey = refId(row.postId) || row.id;
    const prev = byPost.get(postKey);
    if (!prev || recordTime(row) >= recordTime(prev)) {
      byPost.set(postKey, row);
    }
  }
  return [...byPost.values()];
}

/** Пост онлайн, если телеметрия приходила в пределах windowMs (по умолчанию 30 с). */
export function isPostOnline(
  state: { lastMessageAt?: string; createdAt?: string } | undefined,
  now = Date.now(),
  windowMs = POST_ONLINE_THRESHOLD_MS
): boolean {
  if (!state) return false;
  const t = recordTime(state);
  if (t <= 0) return false;
  return now - t <= windowMs;
}

/** ID записей — последний снимок на каждый пост (и категорию для usage). */
export function protectedLatestStatIds(
  groupKey: 'usageStats' | 'financeStats' | 'postStates',
  items: Array<{ id: string; postId?: PostIdRef | string; category?: string }>
): Set<string> {
  if (groupKey === 'financeStats') {
    return new Set(latestFinanceByPost(items as FinanceStat[]).map((r) => r.id));
  }
  if (groupKey === 'usageStats') {
    return new Set(
      latestUsageByPostAndCategory(items as UsageStat[]).map((r) => r.id)
    );
  }
  return new Set(latestPostStateByPost(items).map((r) => r.id));
}

export function resolvePostNumber(
  postId: PostIdRef | string | undefined,
  postById: Map<string, Pick<Post, 'postNumber'>>
): string {
  if (postId != null && typeof postId === 'object' && postId.postNumber != null) {
    return String(postId.postNumber);
  }
  const id = refId(postId);
  if (!id) return '—';
  const post = postById.get(id);
  return post ? String(post.postNumber) : '—';
}

export function resolveStatPostId(postId: PostIdRef | string | undefined): string {
  return refId(postId);
}

export function resolveStatWashAddress(
  washId: WashRef | string,
  postId: PostIdRef | string | undefined,
  postById: Map<string, Pick<Post, 'washId'>>,
  washById: Map<string, Pick<Wash, 'address'>>
): string {
  if (washId != null && typeof washId === 'object' && washId.address) {
    return washId.address;
  }
  const fromStat = resolveWashAddress(washId, washById);
  if (fromStat !== '—' && fromStat !== UNDEFINED_WASH_LABEL) return fromStat;

  const post =
    postId != null && typeof postId === 'object'
      ? postId
      : postById.get(refId(postId));
  const postWashId = post && typeof post === 'object' ? post.washId : undefined;
  return resolveWashAddress(postWashId ?? washId, washById);
}
