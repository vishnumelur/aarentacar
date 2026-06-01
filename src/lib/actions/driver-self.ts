'use server';

import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { driverProfiles } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/get-current-user';

const schema = z.object({
  status: z.enum(['available', 'on_duty', 'off_duty', 'suspended']),
});

export type SetMyStatusOutcome =
  | { ok: true }
  | { ok: false; error: 'forbidden' | 'invalid_input' | 'no_profile' | 'cannot_self_suspend' };

export async function setMyDriverStatus(formData: FormData): Promise<SetMyStatusOutcome> {
  const me = await getCurrentUser();
  if (!me || me.role !== 'driver') {
    return { ok: false, error: 'forbidden' };
  }
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: 'invalid_input' };
  // Drivers cannot self-suspend; only manager can.
  if (parsed.data.status === 'suspended') return { ok: false, error: 'cannot_self_suspend' };

  const [profile] = await db
    .select()
    .from(driverProfiles)
    .where(eq(driverProfiles.userId, me.id))
    .limit(1);
  if (!profile) return { ok: false, error: 'no_profile' };

  await db
    .update(driverProfiles)
    .set({ status: parsed.data.status, updatedAt: new Date() })
    .where(eq(driverProfiles.userId, me.id));

  revalidatePath('/driver');
  return { ok: true };
}
