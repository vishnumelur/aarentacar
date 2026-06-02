'use server';

import { and, eq, isNull } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { notifications } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/get-current-user';

type Outcome = { ok: true } | { ok: false; error: 'forbidden' | 'invalid_input' };

export async function markNotificationRead(formData: FormData): Promise<Outcome> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'forbidden' };
  const id = String(formData.get('id') ?? '');
  if (!id) return { ok: false, error: 'invalid_input' };

  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.id, id), eq(notifications.userId, user.id)));

  revalidatePath('/manager/notifications');
  return { ok: true };
}

export async function markAllNotificationsRead(): Promise<Outcome> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'forbidden' };

  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, user.id), isNull(notifications.readAt)));

  revalidatePath('/manager/notifications');
  return { ok: true };
}
