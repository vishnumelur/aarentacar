'use server';

import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { vehicleCategories, vehicleTypes } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { canAccessPortal } from '@/lib/auth/roles';
import { userCanAgent } from '@/lib/auth/agent-guard';

const updateCategorySchema = z.object({
  id: z.uuid(),
  advanceBookMinDays: z.coerce.number().int().min(0).max(365),
  minDriverAge: z.coerce.number().int().min(18).max(80),
  defaultDepositAed: z.coerce.number().int().min(0).max(100000),
});

export async function updateCategory(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || !(await userCanAgent(user, 'edit_pricing'))) {
    return { ok: false as const, error: 'forbidden' };
  }
  const parsed = updateCategorySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false as const, error: 'invalid_input' };
  }
  await db
    .update(vehicleCategories)
    .set({
      advanceBookMinDays: parsed.data.advanceBookMinDays,
      minDriverAge: parsed.data.minDriverAge,
      defaultDepositAed: parsed.data.defaultDepositAed,
      updatedAt: new Date(),
    })
    .where(eq(vehicleCategories.id, parsed.data.id));
  revalidatePath('/manager/categories');
  return { ok: true as const };
}

const createTypeSchema = z.object({
  categoryId: z.uuid(),
  slug: z.string().min(2).max(40).regex(/^[a-z0-9-]+$/, 'Lowercase letters, numbers, dashes only'),
  nameEn: z.string().min(1).max(80),
  nameAr: z.string().min(1).max(80),
});

export async function createType(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || !canAccessPortal(user.role, 'manager')) {
    return { ok: false as const, error: 'forbidden' };
  }
  const parsed = createTypeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false as const, error: 'invalid_input' };
  try {
    await db.insert(vehicleTypes).values(parsed.data);
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes('vehicle_types_slug_unique')) {
      return { ok: false as const, error: 'slug_taken' };
    }
    throw e;
  }
  revalidatePath('/manager/types');
  return { ok: true as const };
}

const updateTypeSchema = createTypeSchema.extend({ id: z.uuid() });

export async function updateType(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || !canAccessPortal(user.role, 'manager')) {
    return { ok: false as const, error: 'forbidden' };
  }
  const parsed = updateTypeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false as const, error: 'invalid_input' };
  await db
    .update(vehicleTypes)
    .set({
      slug: parsed.data.slug,
      nameEn: parsed.data.nameEn,
      nameAr: parsed.data.nameAr,
    })
    .where(eq(vehicleTypes.id, parsed.data.id));
  revalidatePath('/manager/types');
  return { ok: true as const };
}
