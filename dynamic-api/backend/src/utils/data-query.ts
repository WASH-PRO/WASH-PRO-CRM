/** Преобразует фильтр по полям data.* в MongoDB-запрос. */
export function buildDataMongoFilter(dataFilter: Record<string, unknown>): Record<string, unknown> {
  const buildQuery = (filter: Record<string, unknown>): Record<string, unknown> => {
    if ('$or' in filter && Array.isArray(filter.$or)) {
      return { $or: filter.$or.map((item) => buildQuery(item as Record<string, unknown>)) };
    }
    const query: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(filter)) {
      if (key.startsWith('$')) {
        query[key] = value;
        continue;
      }
      query[`data.${key}`] = value;
    }
    return query;
  };

  return buildQuery(dataFilter);
}

const RESERVED_QUERY_KEYS = new Set(['page', 'limit', 'populate', 'search']);

export interface ParsedListQueryFilters {
  dataFilter: Record<string, unknown>;
  sortField?: string;
  sortDir: 'asc' | 'desc';
}

/** Парсит query-параметры списка Dynamic API в фильтр по data и сортировку. */
export function parseListQueryFilters(query: Record<string, string>): ParsedListQueryFilters {
  const dataFilter: Record<string, unknown> = {};
  let sortField: string | undefined;
  let sortDir: 'asc' | 'desc' = 'desc';

  if (typeof query.sort === 'string' && query.sort.trim()) {
    sortField = query.sort.trim();
  }
  if (query.sortDir === 'asc' || query.sortDir === 'desc') {
    sortDir = query.sortDir;
  }

  for (const [key, value] of Object.entries(query)) {
    if (RESERVED_QUERY_KEYS.has(key) || key === 'sort' || key === 'sortDir') continue;
    if (value === '') continue;

    const fromMatch = key.match(/^(.+)From$/);
    if (fromMatch) {
      const field = fromMatch[1]!;
      const existing = (dataFilter[field] as Record<string, unknown>) || {};
      dataFilter[field] = { ...existing, $gte: value };
      continue;
    }

    const toMatch = key.match(/^(.+)To$/);
    if (toMatch) {
      const field = toMatch[1]!;
      const existing = (dataFilter[field] as Record<string, unknown>) || {};
      dataFilter[field] = { ...existing, $lte: value };
      continue;
    }

    if (value.includes(',')) {
      dataFilter[key] = { $in: value.split(',').map((part) => part.trim()).filter(Boolean) };
    } else {
      dataFilter[key] = value;
    }
  }

  return { dataFilter, sortField, sortDir };
}
