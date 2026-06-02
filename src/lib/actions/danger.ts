'use server';

import { sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { auditLogs } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { DROPPABLE_TABLES, type DroppableTable } from './danger-tables';

type Outcome =
  | { ok: true; message: string }
  | { ok: false; error: 'forbidden' | 'invalid_input' | 'confirmation_mismatch' | 'failed' };

async function requireSuperadmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'superadmin') return null;
  return user;
}

/** DROP a single allowlisted table. Requires the literal confirmation "DROP". */
export async function dropTable(formData: FormData): Promise<Outcome> {
  const admin = await requireSuperadmin();
  if (!admin) return { ok: false, error: 'forbidden' };

  const table = String(formData.get('table') ?? '');
  const confirm = String(formData.get('confirm') ?? '');
  if (!DROPPABLE_TABLES.includes(table as DroppableTable)) {
    return { ok: false, error: 'invalid_input' };
  }
  if (confirm !== 'DROP') return { ok: false, error: 'confirmation_mismatch' };

  try {
    // table is validated against the allowlist above, so sql.raw is safe here.
    await db.execute(sql.raw(`DROP TABLE IF EXISTS "${table}" CASCADE`));
    await db.insert(auditLogs).values({
      actorUserId: admin.id,
      action: 'danger.table_dropped',
      targetType: 'table',
      targetId: table,
    });
    revalidatePath('/admin/danger');
    return { ok: true, message: `Dropped table ${table}.` };
  } catch {
    return { ok: false, error: 'failed' };
  }
}

/**
 * PURGE OLD DATA: delete cancelled/completed bookings older than N days that
 * have no recent activity, for GDPR/PDPL housekeeping. Requires "DROP" confirm.
 */
export async function purgeOldData(formData: FormData): Promise<Outcome> {
  const admin = await requireSuperadmin();
  if (!admin) return { ok: false, error: 'forbidden' };

  const days = Number(formData.get('days') ?? '0');
  const confirm = String(formData.get('confirm') ?? '');
  if (!Number.isInteger(days) || days < 30) return { ok: false, error: 'invalid_input' };
  if (confirm !== 'DROP') return { ok: false, error: 'confirmation_mismatch' };

  try {
    const result = await db.execute(sql`
      DELETE FROM bookings
      WHERE status IN ('cancelled', 'completed')
        AND updated_at < now() - (${days} || ' days')::interval
    `);
    const deleted = (result as { count?: number }).count ?? 0;
    await db.insert(auditLogs).values({
      actorUserId: admin.id,
      action: 'danger.data_purged',
      targetType: 'bookings',
      payload: { olderThanDays: days, deleted },
    });
    revalidatePath('/admin/danger');
    return { ok: true, message: `Purged ${deleted} old booking(s).` };
  } catch {
    return { ok: false, error: 'failed' };
  }
}
