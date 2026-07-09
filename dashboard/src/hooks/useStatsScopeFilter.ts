import { useCallback, useMemo, useState } from 'react';
import { tGlobal } from '../i18n/runtime';

interface StatsScopeFilterOptions<T> {
  rows: T[];
  getWashAddress: (row: T) => string;
  getPostId: (row: T) => string;
}

export function useStatsScopeFilter<T>({
  rows,
  getWashAddress,
  getPostId,
}: StatsScopeFilterOptions<T>) {
  const [washFilter, setWashFilter] = useState('');
  const [postFilter, setPostFilter] = useState('');

  const filtered = useMemo(() => {
    let result = rows;
    if (washFilter) {
      result = result.filter((row) => getWashAddress(row) === washFilter);
    }
    if (postFilter) {
      result = result.filter((row) => getPostId(row) === postFilter);
    }
    return result;
  }, [rows, washFilter, postFilter, getWashAddress, getPostId]);

  const onWashFilterChange = useCallback((value: string) => {
    setWashFilter(value);
    setPostFilter('');
  }, []);

  const onPostSelect = useCallback(
    (row: T) => {
      const postId = getPostId(row);
      if (!postId) return;
      setPostFilter(postId);
      const addr = getWashAddress(row);
      if (addr && addr !== tGlobal('common.notAvailable')) setWashFilter(addr);
    },
    [getPostId, getWashAddress]
  );

  const clearScope = useCallback(() => {
    setWashFilter('');
    setPostFilter('');
  }, []);

  const washOptions = useMemo(() => {
    const addresses = [...new Set(rows.map(getWashAddress))].filter((a) => a && a !== tGlobal('common.notAvailable'));
    return addresses.sort((a, b) => a.localeCompare(b, 'ru'));
  }, [rows, getWashAddress]);

  return {
    washFilter,
    postFilter,
    filtered,
    washOptions,
    hasScope: Boolean(washFilter || postFilter),
    onWashFilterChange,
    onPostSelect,
    clearScope,
  };
}

export function statsScopeHint(
  washFilter: string,
  postFilter: string,
  postLabel?: string
): string {
  if (postFilter && postLabel) return tGlobal('statsScope.post', { post: postLabel });
  if (washFilter) return tGlobal('statsScope.wash', { wash: washFilter });
  return tGlobal('statsScope.default');
}
