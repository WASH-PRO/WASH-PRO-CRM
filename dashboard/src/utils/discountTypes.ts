import type { DiscountType } from '../types';

export const DISCOUNT_TYPE_STATUS_LABELS: Record<NonNullable<DiscountType['status']>, string> = {
  active: 'Активен',
  inactive: 'Неактивен',
};

export function discountTypeStatus(type: DiscountType): NonNullable<DiscountType['status']> {
  return type.status ?? 'active';
}

export function normalizeDiscountTypeCode(code: string): string {
  return code.trim().toUpperCase();
}

export function discountTypesByCode(types: DiscountType[]): Map<string, DiscountType> {
  return new Map(types.map((t) => [normalizeDiscountTypeCode(t.code), t]));
}

export function resolveDiscountTypeLabel(
  discountType: string | number | undefined,
  byCode: Map<string, DiscountType>
): string {
  if (discountType == null || discountType === '') return '—';

  const key = normalizeDiscountTypeCode(String(discountType));
  const found = byCode.get(key);
  if (found) return found.name;

  return String(discountType);
}
