/**
 * Pure promo-code validation + discount computation. The DB row is loaded by
 * the caller (so this stays unit-testable) and passed in as `promo`; pass null
 * when no code matched. On success the caller is responsible for the atomic
 * `used_count` increment (see `src/lib/actions/promos.ts`).
 */

export type PromoKind = 'percent' | 'fixed';

export interface PromoForApply {
  code: string;
  kind: PromoKind;
  value: number;
  minAmountAed: number;
  maxUses: number | null;
  usedCount: number;
  validFrom: Date;
  validTo: Date | null;
  appliesToCategories: string[] | null;
  active: boolean;
}

export interface PromoContext {
  /** Pre-discount rental subtotal in whole AED. */
  subtotalAed: number;
  /** Category id of the booked vehicle, for category-scoped promos. */
  categoryId: string;
  now: Date;
}

export type PromoApplyError =
  | 'code_not_found'
  | 'inactive'
  | 'not_yet_valid'
  | 'expired'
  | 'usage_exceeded'
  | 'below_min_amount'
  | 'category_mismatch';

export type PromoApplyResult =
  | { ok: true; code: string; discountAed: number }
  | { ok: false; error: PromoApplyError };

export function validateAndApplyPromo(
  promo: PromoForApply | null,
  ctx: PromoContext,
): PromoApplyResult {
  if (!promo) return { ok: false, error: 'code_not_found' };
  if (!promo.active) return { ok: false, error: 'inactive' };
  if (ctx.now < promo.validFrom) return { ok: false, error: 'not_yet_valid' };
  if (promo.validTo && ctx.now > promo.validTo) return { ok: false, error: 'expired' };
  if (promo.maxUses !== null && promo.usedCount >= promo.maxUses) {
    return { ok: false, error: 'usage_exceeded' };
  }
  if (ctx.subtotalAed < promo.minAmountAed) {
    return { ok: false, error: 'below_min_amount' };
  }
  if (
    promo.appliesToCategories &&
    promo.appliesToCategories.length > 0 &&
    !promo.appliesToCategories.includes(ctx.categoryId)
  ) {
    return { ok: false, error: 'category_mismatch' };
  }

  const raw =
    promo.kind === 'percent'
      ? Math.floor((ctx.subtotalAed * promo.value) / 100)
      : promo.value;
  const discountAed = Math.max(0, Math.min(raw, ctx.subtotalAed));

  return { ok: true, code: promo.code, discountAed };
}
