'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { customerProfiles } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/get-current-user';

const schema = z.object({
  residency: z.enum(['tourist', 'resident']),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  nationality: z.string().min(2).max(60),
});

export async function saveCustomerProfile(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'customer') {
    return { ok: false as const, error: 'forbidden' };
  }
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false as const, error: 'invalid_input' };

  const ageYears =
    (Date.now() - new Date(parsed.data.dateOfBirth).getTime()) / (365.25 * 24 * 3600 * 1000);
  if (ageYears < 18 || ageYears > 100) {
    return { ok: false as const, error: 'age_out_of_range' };
  }

  const existing = await db
    .select()
    .from(customerProfiles)
    .where(eq(customerProfiles.userId, user.id))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(customerProfiles)
      .set({
        residency: parsed.data.residency,
        dateOfBirth: parsed.data.dateOfBirth,
        nationality: parsed.data.nationality,
        updatedAt: new Date(),
      })
      .where(eq(customerProfiles.userId, user.id));
  } else {
    await db.insert(customerProfiles).values({
      userId: user.id,
      residency: parsed.data.residency,
      dateOfBirth: parsed.data.dateOfBirth,
      nationality: parsed.data.nationality,
    });
  }

  revalidatePath('/profile');
  revalidatePath('/verification');
  return { ok: true as const };
}
