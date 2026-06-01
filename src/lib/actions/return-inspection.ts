'use server';

import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import {
  bookingAssignments,
  bookings,
  bookingEvents,
  damageInspections,
  driverProfiles,
} from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/get-current-user';

const schema = z.object({
  assignmentId: z.uuid(),
  photos: z.array(z.string().min(5).max(500)).min(1).max(20),
  odometer: z.coerce.number().int().min(0).max(2_000_000),
  fuelLevel: z.coerce.number().int().min(0).max(100),
  damageNotes: z.string().max(2000).optional(),
  damageEstimateAed: z.coerce.number().int().min(0).max(1_000_000).optional(),
});

export type RecordReturnOutcome =
  | { ok: true }
  | {
      ok: false;
      error:
        | 'forbidden'
        | 'invalid_input'
        | 'not_found'
        | 'invalid_status'
        | 'no_handover'
        | 'already_recorded';
    };

export async function recordReturn(
  input: z.infer<typeof schema>,
): Promise<RecordReturnOutcome> {
  const me = await getCurrentUser();
  if (!me || me.role !== 'driver') return { ok: false, error: 'forbidden' };

  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid_input' };

  const [assignment] = await db
    .select()
    .from(bookingAssignments)
    .where(eq(bookingAssignments.id, parsed.data.assignmentId))
    .limit(1);
  if (!assignment) return { ok: false, error: 'not_found' };
  if (assignment.driverId !== me.id) return { ok: false, error: 'forbidden' };
  if (assignment.status !== 'accepted') return { ok: false, error: 'invalid_status' };

  const [booking] = await db
    .select()
    .from(bookings)
    .where(eq(bookings.id, assignment.bookingId))
    .limit(1);
  if (!booking) return { ok: false, error: 'not_found' };
  if (booking.status !== 'in_progress') return { ok: false, error: 'invalid_status' };

  // Must have a handover inspection before a return
  const handover = await db
    .select({ id: damageInspections.id })
    .from(damageInspections)
    .where(
      and(
        eq(damageInspections.bookingId, booking.id),
        eq(damageInspections.stage, 'handover'),
      ),
    )
    .limit(1);
  if (handover.length === 0) return { ok: false, error: 'no_handover' };

  // Refuse duplicate return
  const existingReturn = await db
    .select({ id: damageInspections.id })
    .from(damageInspections)
    .where(
      and(
        eq(damageInspections.bookingId, booking.id),
        eq(damageInspections.stage, 'return'),
      ),
    )
    .limit(1);
  if (existingReturn.length > 0) return { ok: false, error: 'already_recorded' };

  await db.transaction(async (tx) => {
    await tx.insert(damageInspections).values({
      bookingId: booking.id,
      stage: 'return',
      photos: parsed.data.photos,
      odometer: parsed.data.odometer,
      fuelLevel: parsed.data.fuelLevel,
      damageNotes: parsed.data.damageNotes ?? null,
      damageEstimateAed: parsed.data.damageEstimateAed ?? null,
      driverId: me.id,
    });

    await tx
      .update(bookings)
      .set({ status: 'completed', updatedAt: new Date() })
      .where(eq(bookings.id, booking.id));

    // Driver returns to available (system-managed)
    await tx
      .update(driverProfiles)
      .set({ status: 'available', updatedAt: new Date() })
      .where(eq(driverProfiles.userId, me.id));

    await tx.insert(bookingEvents).values({
      bookingId: booking.id,
      actorUserId: me.id,
      kind: 'return_completed',
      payload: {
        odometer: parsed.data.odometer,
        fuelLevel: parsed.data.fuelLevel,
        damageNotes: parsed.data.damageNotes ?? null,
        damageEstimateAed: parsed.data.damageEstimateAed ?? null,
      },
    });
  });

  // Manager-side deposit settlement is Plan #7's territory.

  revalidatePath('/driver');
  revalidatePath(`/driver/jobs/${parsed.data.assignmentId}`);
  revalidatePath(`/manager/bookings/${booking.code}`);
  revalidatePath(`/my-bookings/${booking.code}`);

  return { ok: true };
}
