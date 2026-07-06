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

/** Последние записи состояния поста из телеметрии (без полной выгрузки архива). */
export async function fetchPostStateHistory(
  postSerial: string,
  options?: {
    signal?: AbortSignal;
    pageSize?: number;
    maxPages?: number;
    stopBefore?: number;
  }
): Promise<{ rows: PostStateHistoryRow[]; truncated: boolean }> {
  const pageSize = options?.pageSize ?? DEFAULT_PAGE_SIZE;
  const maxPages = options?.maxPages ?? DEFAULT_MAX_PAGES;
  const rows: PostStateHistoryRow[] = [];
  let page = 1;
  let totalPages = 1;
  let truncated = false;

  while (page <= totalPages && page <= maxPages) {
    if (options?.signal?.aborted) throw new DOMException('Aborted', 'AbortError');

    const { data, pagination } = await apiListPage<TelemetryStateRow>(
      '/crm/telemetry',
      page,
      pageSize,
      options?.signal
    );
    totalPages = pagination.totalPages;

    if (data.length === 0) break;

    let pageOlderThanStop = options?.stopBefore != null;

    for (const row of data) {
      const receivedAt = row.receivedAt ? new Date(row.receivedAt).getTime() : 0;
      if (options?.stopBefore != null && receivedAt >= options.stopBefore) {
        pageOlderThanStop = false;
      }
      if (row.postSerial !== postSerial || !STATE_MESSAGE_TYPES.has(row.messageType)) continue;
      rows.push(mapTelemetryToStateRow(row));
    }

    if (pageOlderThanStop) break;
    page += 1;
  }

  if (page <= totalPages) truncated = true;

  const sorted = rows.sort(
    (a, b) => new Date(b.receivedAt || 0).getTime() - new Date(a.receivedAt || 0).getTime()
  );
  return { rows: sorted, truncated };
}
