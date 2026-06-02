'use server';

import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { users, auditLogs } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { destroyAllSessionsForUser } from '@/lib/auth/session';
import { hashPassword } from '@/lib/auth/password';
import type { Role } from '@/lib/auth/roles';

const ROLES: Role[] = ['customer', 'driver', 'agent', 'manager', 'superadmin'];

type Outcome = { ok: true } | { ok: false; error: 'forbidden' | 'invalid_input' | 'not_found' };

async function requireSuperadmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'superadmin') return null;
  return user;
}

/** Change a user's role (any transition), audited. */
export async function changeUserRole(formData: FormData): Promise<Outcome> {
  const admin = await requireSuperadmin();
  if (!admin) return { ok: false, error: 'forbidden' };
  const userId = String(formData.get('userId') ?? '');
  const role = String(formData.get('role') ?? '') as Role;
  if (!userId || !ROLES.includes(role)) return { ok: false, error: 'invalid_input' };

  const [target] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!target) return { ok: false, error: 'not_found' };

  await db.update(users).set({ role, updatedAt: new Date() }).where(eq(users.id, userId));
  await db.insert(auditLogs).values({
    actorUserId: admin.id,
    action: 'user.role_changed',
    targetType: 'user',
    targetId: userId,
    payload: { from: target.role, to: role },
  });
  revalidatePath('/admin/users');
  revalidatePath(`/admin/users/${userId}`);
  return { ok: true };
}

/** Suspend a user: flip status + invalidate all sessions so they're logged out. */
export async function suspendUser(formData: FormData): Promise<Outcome> {
  const admin = await requireSuperadmin();
  if (!admin) return { ok: false, error: 'forbidden' };
  const userId = String(formData.get('userId') ?? '');
  if (!userId) return { ok: false, error: 'invalid_input' };
  if (userId === admin.id) return { ok: false, error: 'invalid_input' };

  const [target] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!target) return { ok: false, error: 'not_found' };

  await db.update(users).set({ status: 'suspended', updatedAt: new Date() }).where(eq(users.id, userId));
  await destroyAllSessionsForUser(db, userId);
  await db.insert(auditLogs).values({
    actorUserId: admin.id,
    action: 'user.suspended',
    targetType: 'user',
    targetId: userId,
  });
  revalidatePath('/admin/users');
  revalidatePath(`/admin/users/${userId}`);
  return { ok: true };
}

export async function reinstateUser(formData: FormData): Promise<Outcome> {
  const admin = await requireSuperadmin();
  if (!admin) return { ok: false, error: 'forbidden' };
  const userId = String(formData.get('userId') ?? '');
  if (!userId) return { ok: false, error: 'invalid_input' };

  await db.update(users).set({ status: 'active', updatedAt: new Date() }).where(eq(users.id, userId));
  await db.insert(auditLogs).values({
    actorUserId: admin.id,
    action: 'user.reinstated',
    targetType: 'user',
    targetId: userId,
  });
  revalidatePath('/admin/users');
  revalidatePath(`/admin/users/${userId}`);
  return { ok: true };
}

export type ResetPasswordOutcome =
  | { ok: true; tempPassword: string }
  | { ok: false; error: 'forbidden' | 'invalid_input' | 'not_found' };

/**
 * Reset a user's password to a random temporary value and invalidate sessions.
 * Spec calls for a magic-link email; the mail server lands in Plan #12, so for
 * now we surface the temp password to the admin once (verify-on-deploy: swap to
 * an emailed reset link once Postfix is wired). Audited.
 */
export async function resetUserPassword(formData: FormData): Promise<ResetPasswordOutcome> {
  const admin = await requireSuperadmin();
  if (!admin) return { ok: false, error: 'forbidden' };
  const userId = String(formData.get('userId') ?? '');
  if (!userId) return { ok: false, error: 'invalid_input' };

  const [target] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!target) return { ok: false, error: 'not_found' };

  const tempPassword = randomBytes(12).toString('base64url');
  const passwordHash = await hashPassword(tempPassword);
  await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, userId));
  await destroyAllSessionsForUser(db, userId);
  await db.insert(auditLogs).values({
    actorUserId: admin.id,
    action: 'user.password_reset',
    targetType: 'user',
    targetId: userId,
  });
  revalidatePath(`/admin/users/${userId}`);
  return { ok: true, tempPassword };
}
