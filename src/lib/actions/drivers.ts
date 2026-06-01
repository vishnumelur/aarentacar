'use server';

import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { users, driverProfiles, auditLogs } from '@/db/schema';
import { hashPassword } from '@/lib/auth/password';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { canAccessPortal } from '@/lib/auth/roles';

const createSchema = z.object({
  email: z.email().transform((s) => s.toLowerCase().trim()),
  password: z.string().min(12).max(128),
  fullName: z.string().min(1).max(120).transform((s) => s.trim()),
  phone: z.string().min(7).max(20).optional(),
  licenseNo: z.string().min(1).max(40),
  licenseExpiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type CreateDriverOutcome =
  | { ok: true; userId: string }
  | { ok: false; error: 'forbidden' | 'invalid_input' | 'email_taken' };

export async function createDriver(formData: FormData): Promise<CreateDriverOutcome> {
  const me = await getCurrentUser();
  if (!me || !canAccessPortal(me.role, 'manager')) {
    return { ok: false, error: 'forbidden' };
  }
  const parsed = createSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: 'invalid_input' };

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, parsed.data.email))
    .limit(1);
  if (existing.length > 0) return { ok: false, error: 'email_taken' };

  const passwordHash = await hashPassword(parsed.data.password);

  const result = await db.transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({
        email: parsed.data.email,
        passwordHash,
        fullName: parsed.data.fullName,
        phone: parsed.data.phone ?? null,
        role: 'driver',
        verificationStatus: 'verified', // Drivers don't need KYC; manager vouches.
      })
      .returning({ id: users.id });
    if (!user) throw new Error('user_insert_failed');

    await tx.insert(driverProfiles).values({
      userId: user.id,
      licenseNo: parsed.data.licenseNo,
      licenseExpiry: parsed.data.licenseExpiry,
      status: 'off_duty',
    });

    await tx.insert(auditLogs).values({
      actorUserId: me.id,
      action: 'driver.created',
      targetType: 'driver',
      targetId: user.id,
      payload: { email: parsed.data.email },
    });

    return user.id;
  });

  revalidatePath('/manager/drivers');
  redirect(`/manager/drivers/${result}`);
}

const updateSchema = z.object({
  userId: z.uuid(),
  fullName: z.string().min(1).max(120).transform((s) => s.trim()),
  phone: z.string().min(7).max(20).optional(),
  licenseNo: z.string().min(1).max(40),
  licenseExpiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type UpdateDriverOutcome =
  | { ok: true }
  | { ok: false; error: 'forbidden' | 'invalid_input' | 'not_found' };

export async function updateDriver(formData: FormData): Promise<UpdateDriverOutcome> {
  const me = await getCurrentUser();
  if (!me || !canAccessPortal(me.role, 'manager')) {
    return { ok: false, error: 'forbidden' };
  }
  const parsed = updateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: 'invalid_input' };

  const [profile] = await db
    .select()
    .from(driverProfiles)
    .where(eq(driverProfiles.userId, parsed.data.userId))
    .limit(1);
  if (!profile) return { ok: false, error: 'not_found' };

  await db
    .update(users)
    .set({
      fullName: parsed.data.fullName,
      phone: parsed.data.phone ?? null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, parsed.data.userId));

  await db
    .update(driverProfiles)
    .set({
      licenseNo: parsed.data.licenseNo,
      licenseExpiry: parsed.data.licenseExpiry,
      updatedAt: new Date(),
    })
    .where(eq(driverProfiles.userId, parsed.data.userId));

  revalidatePath('/manager/drivers');
  revalidatePath(`/manager/drivers/${parsed.data.userId}`);
  return { ok: true };
}

const toggleSchema = z.object({
  userId: z.uuid(),
  status: z.enum(['available', 'on_duty', 'off_duty', 'suspended']),
});

export async function setDriverStatus(formData: FormData): Promise<UpdateDriverOutcome> {
  const me = await getCurrentUser();
  if (!me || !canAccessPortal(me.role, 'manager')) {
    return { ok: false, error: 'forbidden' };
  }
  const parsed = toggleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: 'invalid_input' };

  await db
    .update(driverProfiles)
    .set({ status: parsed.data.status, updatedAt: new Date() })
    .where(eq(driverProfiles.userId, parsed.data.userId));

  revalidatePath('/manager/drivers');
  revalidatePath(`/manager/drivers/${parsed.data.userId}`);
  return { ok: true };
}
