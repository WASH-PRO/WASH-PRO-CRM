import type { DiscountType } from '../types';

export const DISCOUNT_TYPE_STATUS_LABELS: Record<NonNullable<DiscountType['status']>, string> = {
  active: 'Активен',
  inactive: 'Неактивен',
};

export function discountTypeStatus(type: DiscountType): NonNullable<DiscountType['status']> {
  return type.status ?? 'active';
}

export function discountTypesByNumber(types: DiscountType[]): Map<number, DiscountType> {
  return new Map(types.map((t) => [t.number, t]));
}

export function resolveDiscountTypeLabel(
  discountType: string | number | undefined,
  byNumber: Map<number, DiscountType>
): string {
  if (discountType == null || discountType === '') return '—';
  const num = Number(discountType);
  if (!Number.isNaN(num) && byNumber.has(num)) {
    return byNumber.get(num)!.name;
  }
  return String(discountType);
}
