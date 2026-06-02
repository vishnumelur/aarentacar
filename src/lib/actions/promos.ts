'use server';

import { z } from 'zod';
import { eq, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { promoCodes, bookings, auditLogs } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { userCanAgent } from '@/lib/auth/agent-guard';

type PromoError = 'forbidden' | 'invalid_input' | 'not_found' | 'code_taken';

export type PromoMutationOutcome =
  | { ok: true; id: string }
  | { ok: false; error: PromoError };

const baseSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(/^[A-Za-z0-9_-]+$/, 'Letters, numbers, dash, underscore only')
    .transform((s) => s.toUpperCase()),
  kind: z.enum(['percent', 'fixed']),
  value: z.coerce.number().int().min(1).max(1_000_000),
  minAmountAed: z.coerce.number().int().min(0).max(1_000_000).default(0),
  maxUses: z
    .union([z.coerce.number().int().min(1).max(1_000_000), z.literal('')])
    .optional()
    .transform((v) => (v === '' || v === undefined ? null : v)),
  validFrom: z.coerce.date(),
  validTo: z
    .union([z.coerce.date(), z.literal('')])
    .optional()
    .transform((v) => (v === '' || v === undefined ? null : v)),
  appliesToCategories: z
    .string()
    .optional()
    .transform((v) =>
      v
        ? v
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : null,
    ),
  active: z
    .union([z.literal('on'), z.literal('true'), z.literal('false'), z.boolean()])
    .optional()
    .transform((v) => v === 'on' || v === 'true' || v === true),
});

export async function createPromo(formData: FormData): Promise<PromoMutationOutcome> {
  const user = await getCurrentUser();
  if (!(await userCanAgent(user, 'manage_promos'))) {
    return { ok: false, error: 'forbidden' };
  }
  const parsed = baseSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: 'invalid_input' };

  try {
    const [row] = await db
      .insert(promoCodes)
      .values({
        code: parsed.data.code,
        kind: parsed.data.kind,
        value: parsed.data.value,
        minAmountAed: parsed.data.minAmountAed,
        maxUses: parsed.data.maxUses,
        validFrom: parsed.data.validFrom,
        validTo: parsed.data.validTo,
        appliesToCategories: parsed.data.appliesToCategories,
        active: parsed.data.active,
      })
      .returning({ id: promoCodes.id });
    if (!row) return { ok: false, error: 'invalid_input' };

    await db.insert(auditLogs).values({
      actorUserId: user!.id,
      action: 'promo.created',
      targetType: 'promo_code',
      targetId: row.id,
      payload: { code: parsed.data.code },
    });

    revalidatePath('/manager/promos');
    return { ok: true, id: row.id };
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes('promo_codes_code_unique')) {
      return { ok: false, error: 'code_taken' };
    }
    throw e;
  }
}

const updateSchema = baseSchema.extend({ id: z.uuid() });

export async function updatePromo(formData: FormData): Promise<PromoMutationOutcome> {
  const user = await getCurrentUser();
  if (!(await userCanAgent(user, 'manage_promos'))) {
    return { ok: false, error: 'forbidden' };
  }
  const parsed = updateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: 'invalid_input' };

  const [existing] = await db
    .select({ id: promoCodes.id })
    .from(promoCodes)
    .where(eq(promoCodes.id, parsed.data.id))
    .limit(1);
  if (!existing) return { ok: false, error: 'not_found' };

  try {
    await db
      .update(promoCodes)
      .set({
        code: parsed.data.code,
        kind: parsed.data.kind,
        value: parsed.data.value,
        minAmountAed: parsed.data.minAmountAed,
        maxUses: parsed.data.maxUses,
        validFrom: parsed.data.validFrom,
        validTo: parsed.data.validTo,
        appliesToCategories: parsed.data.appliesToCategories,
        active: parsed.data.active,
      })
      .where(eq(promoCodes.id, parsed.data.id));
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes('promo_codes_code_unique')) {
      return { ok: false, error: 'code_taken' };
    }
    throw e;
  }

  await db.insert(auditLogs).values({
    actorUserId: user!.id,
    action: 'promo.updated',
    targetType: 'promo_code',
    targetId: parsed.data.id,
    payload: { code: parsed.data.code },
  });

  revalidatePath('/manager/promos');
  revalidatePath(`/manager/promos/${parsed.data.id}`);
  return { ok: true, id: parsed.data.id };
}

export async function setPromoActive(formData: FormData): Promise<PromoMutationOutcome> {
  const user = await getCurrentUser();
  if (!(await userCanAgent(user, 'manage_promos'))) {
    return { ok: false, error: 'forbidden' };
  }
  const id = String(formData.get('id') ?? '');
  const active = String(formData.get('active') ?? '') === 'true';
  if (!id) return { ok: false, error: 'invalid_input' };

  const [existing] = await db
    .select({ id: promoCodes.id, code: promoCodes.code })
    .from(promoCodes)
    .where(eq(promoCodes.id, id))
    .limit(1);
  if (!existing) return { ok: false, error: 'not_found' };

  await db.update(promoCodes).set({ active }).where(eq(promoCodes.id, id));

  await db.insert(auditLogs).values({
    actorUserId: user!.id,
    action: active ? 'promo.activated' : 'promo.deactivated',
    targetType: 'promo_code',
    targetId: id,
    payload: { code: existing.code },
  });

  revalidatePath('/manager/promos');
  revalidatePath(`/manager/promos/${id}`);
  return { ok: true, id };
}

/** Void-returning wrapper for direct use as a `<form action>`. */
export async function setPromoActiveForm(formData: FormData): Promise<void> {
  await setPromoActive(formData);
}

export interface PromoUsageStats {
  bookingsUsed: number;
  totalDiscountAed: number;
}

/** How many bookings used this promo code and the total discount granted. */
export async function promoUsageStats(code: string): Promise<PromoUsageStats> {
  const [row] = await db
    .select({
      bookingsUsed: sql<number>`count(*)`,
      totalDiscountAed: sql<number>`coalesce(sum(${bookings.discountAed}), 0)`,
    })
    .from(bookings)
    .where(eq(bookings.appliedPromoCode, code));
  return {
    bookingsUsed: Number(row?.bookingsUsed ?? 0),
    totalDiscountAed: Number(row?.totalDiscountAed ?? 0),
  };
}
