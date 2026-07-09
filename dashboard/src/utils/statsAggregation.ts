import { refId, resolveWashAddress, UNDEFINED_WASH_LABEL } from './refs';
import type { FinanceStat, Post, PostIdRef, UsageStat, Wash, WashRef } from '../types';
import { tGlobal } from '../i18n/runtime';

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

/** Секунды использования: usageTime или legacy clientCount/launchCount (минуты с панели). */
export function resolveUsageSeconds(stat: UsageStat): number {
  if (stat.usageTime != null && stat.usageTime > 0) return stat.usageTime;
  if (stat.clientCount != null && stat.clientCount > 0) return stat.clientCount * 60;
  if (stat.launchCount != null && stat.launchCount > 0) return stat.launchCount * 60;
  return 0;
}

/** Сумма секунд по категории с учётом legacy-маппинга aservices → regular.launchCount. */
export function resolveCategoryUsageSeconds(
  stats: UsageStat[],
  category: UsageStat['category']
): number {
  const total = stats
    .filter((s) => s.category === category)
    .reduce((sum, s) => sum + resolveUsageSeconds(s), 0);
  if (total > 0 || category !== 'service') return total;
  return stats
    .filter((s) => s.category === 'regular')
    .reduce((sum, s) => sum + (s.launchCount || 0) * 60, 0);
}

/** Последняя запись на каждый пост, период, категорию и тип скидки (использование). */
export function latestUsageByPostAndCategory(stats: UsageStat[]): UsageStat[] {
  const byKey = new Map<string, UsageStat>();
  for (const row of stats) {
    const postKey = refId(row.postId) || row.id;
    const discountKey = row.discountType?.trim() || '';
    const key = `${postKey}:${row.period || 'before_collection'}:${row.category}:${discountKey}`;
    const prev = byKey.get(key);
    if (!prev || recordTime(row) >= recordTime(prev)) {
      byKey.set(key, row);
    }
  }
  return [...byKey.values()];
}

export interface CardUsageChartItem {
  key: string;
  name: string;
  value: number;
  fill: string;
}

function sumUsageSeconds(stats: UsageStat[], match: (s: UsageStat) => boolean): number {
  return stats.filter(match).reduce((sum, s) => sum + resolveUsageSeconds(s), 0);
}

const USAGE_SHARE_COLORS = {
  clients: '#0891b2',
  service: '#6366f1',
  vip: '#0f766e',
} as const;

/** Секции круговой диаграммы «Использование» на главной (до инкассации). */
export function buildDashboardUsageShareSeries(stats: UsageStat[]): CardUsageChartItem[] {
  const latest = latestUsageByPostAndCategory(stats);
  const before = latest.filter((s) => s.period === 'before_collection');

  const clients = sumUsageSeconds(before, (s) => s.category === 'regular');
  const service = resolveCategoryUsageSeconds(before, 'service');
  const vip = resolveCategoryUsageSeconds(before, 'unlimited');

  return [
    { key: 'clients', name: tGlobal('statsAggregation.usage.clients'), value: clients, fill: USAGE_SHARE_COLORS.clients },
    { key: 'service', name: tGlobal('statsAggregation.usage.service'), value: service, fill: USAGE_SHARE_COLORS.service },
    { key: 'vip', name: tGlobal('statsAggregation.usage.vip'), value: vip, fill: USAGE_SHARE_COLORS.vip },
  ];
}

export interface PaymentShareChartItem {
  key: string;
  name: string;
  value: number;
  fill: string;
}

const PAYMENT_SHARE_COLORS = {
  cash: '#059669',
  cashless: '#6366f1',
  discount: '#f59e0b',
} as const;

/** Секции круговой диаграммы поступлений на главной (до инкассации). */
export function buildDashboardPaymentShareSeries(stats: FinanceStat[]): PaymentShareChartItem[] {
  const latest = latestFinanceByPost(stats);
  const cash = latest.reduce((sum, row) => sum + (row.cash || 0), 0);
  const cashless = latest.reduce((sum, row) => sum + (row.cashless || 0), 0);
  const discounts = latest.reduce((sum, row) => sum + (row.discountOps || 0), 0);

  return [
    { key: 'cash', name: tGlobal('statsAggregation.payment.cash'), value: cash, fill: PAYMENT_SHARE_COLORS.cash },
    { key: 'cashless', name: tGlobal('statsAggregation.payment.cashless'), value: cashless, fill: PAYMENT_SHARE_COLORS.cashless },
    { key: 'discount', name: tGlobal('statsAggregation.payment.discount'), value: discounts, fill: PAYMENT_SHARE_COLORS.discount },
  ];
}

/** Точка дневного графика на главной. */
export interface DashboardTimelinePoint {
  name: string;
  value: number;
}

function buildDashboardTimelineByDate<T extends { recordedAt?: string }>(
  items: T[],
  locale: string,
  currentLabel: string,
  valueOf: (item: T) => number
): DashboardTimelinePoint[] {
  const byDate: Record<string, { value: number; ts: number }> = {};
  for (const item of items) {
    const ts = item.recordedAt ? new Date(item.recordedAt).getTime() : 0;
    const key = item.recordedAt
      ? new Date(item.recordedAt).toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-US', {
          day: '2-digit',
          month: 'short',
        })
      : currentLabel;
    if (!byDate[key]) byDate[key] = { value: 0, ts };
    byDate[key].value += valueOf(item);
    byDate[key].ts = Math.max(byDate[key].ts, ts);
  }
  return Object.entries(byDate)
    .map(([name, { value, ts }]) => ({ name, value, ts }))
    .sort((a, b) => a.ts - b.ts)
    .map(({ name, value }) => ({ name, value }));
}

/** Выручка по дням (главная). */
export function buildDashboardRevenueTimeline(
  stats: FinanceStat[],
  locale: string,
  currentLabel: string
): DashboardTimelinePoint[] {
  return buildDashboardTimelineByDate(stats, locale, currentLabel, (s) => s.totalRevenue || 0).map(
    ({ name, value }) => ({ name, value: Math.round(value) })
  );
}

/** Загруженность (секунды использования) по дням (главная). */
export function buildDashboardWorkloadTimeline(
  stats: UsageStat[],
  locale: string,
  currentLabel: string
): DashboardTimelinePoint[] {
  return buildDashboardTimelineByDate(stats, locale, currentLabel, resolveUsageSeconds).map(({ name, value }) => ({
    name,
    value: Math.round(value),
  }));
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
  if (!id) return tGlobal('common.notAvailable');
  const post = postById.get(id);
  return post ? String(post.postNumber) : tGlobal('common.notAvailable');
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
  if (fromStat !== tGlobal('common.notAvailable') && fromStat !== UNDEFINED_WASH_LABEL) return fromStat;

  const post =
    postId != null && typeof postId === 'object'
      ? postId
      : postById.get(refId(postId));
  const postWashId = post && typeof post === 'object' ? post.washId : undefined;
  return resolveWashAddress(postWashId ?? washId, washById);
}
