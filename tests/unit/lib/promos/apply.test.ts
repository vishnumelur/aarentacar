import { describe, it, expect } from 'vitest';
import { validateAndApplyPromo, type PromoForApply } from '@/lib/promos/apply';

const now = new Date('2026-06-01T12:00:00Z');

function makePromo(over: Partial<PromoForApply> = {}): PromoForApply {
  return {
    code: 'SAVE10',
    kind: 'percent',
    value: 10,
    minAmountAed: 0,
    maxUses: null,
    usedCount: 0,
    validFrom: new Date('2026-01-01T00:00:00Z'),
    validTo: new Date('2026-12-31T23:59:59Z'),
    appliesToCategories: null,
    active: true,
    ...over,
  };
}

describe('validateAndApplyPromo', () => {
  it('returns code_not_found when promo is null', () => {
    const r = validateAndApplyPromo(null, { subtotalAed: 1000, categoryId: 'c1', now });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('code_not_found');
  });

  it('applies a percent discount, floored', () => {
    const r = validateAndApplyPromo(makePromo({ kind: 'percent', value: 15 }), {
      subtotalAed: 333,
      categoryId: 'c1',
      now,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.discountAed).toBe(49); // floor(333*0.15)=49
  });

  it('applies a fixed discount capped at subtotal', () => {
    const r = validateAndApplyPromo(makePromo({ kind: 'fixed', value: 200 }), {
      subtotalAed: 150,
      categoryId: 'c1',
      now,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.discountAed).toBe(150);
  });

  it('rejects an inactive code', () => {
    const r = validateAndApplyPromo(makePromo({ active: false }), {
      subtotalAed: 1000,
      categoryId: 'c1',
      now,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('inactive');
  });

  it('rejects before validFrom and after validTo', () => {
    const early = validateAndApplyPromo(
      makePromo({ validFrom: new Date('2026-07-01T00:00:00Z') }),
      { subtotalAed: 1000, categoryId: 'c1', now },
    );
    expect(early.ok).toBe(false);
    if (!early.ok) expect(early.error).toBe('not_yet_valid');

    const late = validateAndApplyPromo(
      makePromo({ validTo: new Date('2026-05-01T00:00:00Z') }),
      { subtotalAed: 1000, categoryId: 'c1', now },
    );
    expect(late.ok).toBe(false);
    if (!late.ok) expect(late.error).toBe('expired');
  });

  it('rejects when used_count >= max_uses', () => {
    const r = validateAndApplyPromo(makePromo({ maxUses: 5, usedCount: 5 }), {
      subtotalAed: 1000,
      categoryId: 'c1',
      now,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('usage_exceeded');
  });

  it('rejects when subtotal below min_amount', () => {
    const r = validateAndApplyPromo(makePromo({ minAmountAed: 500 }), {
      subtotalAed: 400,
      categoryId: 'c1',
      now,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('below_min_amount');
  });

  it('enforces category match when appliesToCategories is set', () => {
    const promo = makePromo({ appliesToCategories: ['cat-a', 'cat-b'] });
    const miss = validateAndApplyPromo(promo, { subtotalAed: 1000, categoryId: 'cat-c', now });
    expect(miss.ok).toBe(false);
    if (!miss.ok) expect(miss.error).toBe('category_mismatch');

    const hit = validateAndApplyPromo(promo, { subtotalAed: 1000, categoryId: 'cat-a', now });
    expect(hit.ok).toBe(true);
  });

  it('null appliesToCategories applies to all categories', () => {
    const r = validateAndApplyPromo(makePromo({ appliesToCategories: null }), {
      subtotalAed: 1000,
      categoryId: 'anything',
      now,
    });
    expect(r.ok).toBe(true);
  });

  it('treats null validTo as no expiry', () => {
    const r = validateAndApplyPromo(makePromo({ validTo: null }), {
      subtotalAed: 1000,
      categoryId: 'c1',
      now,
    });
    expect(r.ok).toBe(true);
  });
});
