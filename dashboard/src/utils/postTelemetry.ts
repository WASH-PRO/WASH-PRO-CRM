import { apiListPage } from '../api/client';

const STATE_MESSAGE_TYPES = new Set(['process', 'state']);
const DEFAULT_PAGE_SIZE = 100;
const DEFAULT_MAX_PAGES = 25;

export interface TelemetryStateRow {
  id: string;
  postSerial?: string;
  messageType: string;
  payload: Record<string, unknown>;
  receivedAt?: string;
}

function numOrUndefined(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export interface PostStateHistoryRow {
  id: string;
  balance?: number;
  discount?: number;
  freePause?: number;
  modeName?: string;
  receivedAt?: string;
}

export function mapTelemetryToStateRow(row: TelemetryStateRow): PostStateHistoryRow {
  const p = row.payload || {};
  const modeNumber = numOrUndefined(p.number ?? p.modeNumber ?? p.mode_number);
  const modeName =
    (p.modeName != null ? String(p.modeName) : undefined) ||
    (p.mode_name != null ? String(p.mode_name) : undefined) ||
    (p.mode != null ? String(p.mode) : undefined) ||
    (modeNumber != null && modeNumber >= 0 ? `program_${modeNumber}` : undefined);

  return {
    id: row.id,
    balance: numOrUndefined(p.balance ?? p.currentBalance ?? p.current_balance),
    discount: numOrUndefined(p.discount),
    freePause: numOrUndefined(p.pause ?? p.free_pause ?? p.freePause),
    modeName,
    receivedAt: row.receivedAt,
  };
}

function buildTelemetryHistoryPath(
  postSerial: string,
  options?: {
    receivedAtFrom?: string;
    receivedAtTo?: string;
  }
): string {
  const params = new URLSearchParams({
    postSerial,
    messageType: 'state,process',
    sort: 'receivedAt',
    sortDir: 'desc',
  });
  if (options?.receivedAtFrom) params.set('receivedAtFrom', options.receivedAtFrom);
  if (options?.receivedAtTo) params.set('receivedAtTo', options.receivedAtTo);
  return `/crm/telemetry?${params.toString()}`;
}

/** Последние записи состояния поста из телеметрии (фильтр на сервере по postSerial). */
export async function fetchPostStateHistory(
  postSerial: string,
  options?: {
    signal?: AbortSignal;
    pageSize?: number;
    maxPages?: number;
    receivedAtFrom?: string;
    receivedAtTo?: string;
  }
): Promise<{ rows: PostStateHistoryRow[]; truncated: boolean }> {
  const pageSize = options?.pageSize ?? DEFAULT_PAGE_SIZE;
  const maxPages = options?.maxPages ?? DEFAULT_MAX_PAGES;
  const path = buildTelemetryHistoryPath(postSerial, {
    receivedAtFrom: options?.receivedAtFrom,
    receivedAtTo: options?.receivedAtTo,
  });

  const rows: PostStateHistoryRow[] = [];
  let page = 1;
  let totalPages = 1;
  let truncated = false;

  while (page <= totalPages && page <= maxPages) {
    if (options?.signal?.aborted) throw new DOMException('Aborted', 'AbortError');

    const { data, pagination } = await apiListPage<TelemetryStateRow>(
      path,
      page,
      pageSize,
      options?.signal
    );
    totalPages = pagination.totalPages;

    if (data.length === 0) break;

    for (const row of data) {
      if (!STATE_MESSAGE_TYPES.has(row.messageType)) continue;
      rows.push(mapTelemetryToStateRow(row));
    }

    page += 1;
  }

  if (page <= totalPages) truncated = true;

  return { rows, truncated };
}
