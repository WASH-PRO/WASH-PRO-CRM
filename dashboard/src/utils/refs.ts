import type { WashRef } from '../types';
import { tGlobal } from '../i18n/runtime';

/** Подпись, если автомойка удалена или не найдена в справочнике. */
export const UNDEFINED_WASH_LABEL = tGlobal('refs.undefinedWash');

export function refId(value: string | { id?: string; _id?: string } | null | undefined): string {
  if (value == null) return '';
  if (typeof value === 'object') return String(value.id ?? value._id ?? '');
  return String(value);
}

/** Адрес автомойки из washId (с populate или из справочника). */
export function resolveWashAddress(
  washId: string | { address?: string; id?: string; _id?: string } | null | undefined,
  washById: Map<string, { address?: string }>
): string {
  if (washId != null && typeof washId === 'object' && washId.address) return washId.address;
  const id = refId(washId);
  if (!id) return tGlobal('common.notAvailable');
  return washById.get(id)?.address ?? UNDEFINED_WASH_LABEL;
}

/** Название автомойки из washId (с populate или из справочника). */
export function resolveWashName(
  washId: string | { name?: string; id?: string; _id?: string } | null | undefined,
  washById: Map<string, { name?: string }>
): string {
  if (washId != null && typeof washId === 'object' && washId.name) return washId.name;
  const id = refId(washId);
  if (!id) return tGlobal('common.notAvailable');
  return washById.get(id)?.name ?? UNDEFINED_WASH_LABEL;
}

/** Подпись поста применения карты (с populate или из справочников). */
export function resolvePostLabel(
  postId: string | { postNumber?: number; name?: string; washId?: WashRef; id?: string; _id?: string } | null | undefined,
  postById: Map<string, { postNumber?: number; name?: string; washId?: WashRef }>,
  washById: Map<string, { name?: string }>
): string {
  const post =
    postId != null && typeof postId === 'object'
      ? postId
      : postById.get(refId(postId));
  if (!post) return tGlobal('common.notAvailable');

  const postName =
    post.name || (post.postNumber != null ? tGlobal('refs.postWithNumber', { number: post.postNumber }) : tGlobal('refs.post'));
  const washName = resolveWashName(post.washId, washById);
  return washName !== tGlobal('common.notAvailable') && washName !== UNDEFINED_WASH_LABEL
    ? `#${post.postNumber ?? tGlobal('common.notAvailable')} ${postName} · ${washName}`
    : `#${post.postNumber ?? tGlobal('common.notAvailable')} ${postName}`;
}
