'use server';

import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { bookingAssignments, bookings, bookingEvents } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/get-current-user';

const acceptSchema = z.object({ assignmentId: z.uuid() });

export type AcceptOutcome =
  | { ok: true }
  | { ok: false; error: 'forbidden' | 'invalid_input' | 'not_found' | 'invalid_status' };

export async function acceptJob(input: z.infer<typeof acceptSchema>): Promise<AcceptOutcome> {
  const me = await getCurrentUser();
  if (!me || me.role !== 'driver') return { ok: false, error: 'forbidden' };
  const parsed = acceptSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid_input' };

  return await db.transaction(async (tx) => {
    const [assignment] = await tx
      .select()
      .from(bookingAssignments)
      .where(eq(bookingAssignments.id, parsed.data.assignmentId))
      .limit(1);
    if (!assignment) return { ok: false as const, error: 'not_found' };
    if (assignment.driverId !== me.id) return { ok: false as const, error: 'forbidden' };
    if (assignment.status !== 'offered') return { ok: false as const, error: 'invalid_status' };

    await tx
      .update(bookingAssignments)
      .set({ status: 'accepted', acceptedAt: new Date() })
      .where(eq(bookingAssignments.id, parsed.data.assignmentId));

    await tx.insert(bookingEvents).values({
      bookingId: assignment.bookingId,
      actorUserId: me.id,
      kind: 'driver_accepted',
      payload: { assignmentId: parsed.data.assignmentId },
    });

    revalidatePath('/driver');
    revalidatePath(`/driver/jobs/${parsed.data.assignmentId}`);
    return { ok: true as const };
  });
}

const declineSchema = z.object({
  assignmentId: z.uuid(),
  reason: z.string().trim().min(1).max(500),
});

export type DeclineOutcome =
  | { ok: true }
  | { ok: false; error: 'forbidden' | 'invalid_input' | 'not_found' | 'invalid_status' };

export async function declineJob(input: z.infer<typeof declineSchema>): Promise<DeclineOutcome> {
  const me = await getCurrentUser();
  if (!me || me.role !== 'driver') return { ok: false, error: 'forbidden' };
  const parsed = declineSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid_input' };

  return await db.transaction(async (tx) => {
    const [assignment] = await tx
      .select()
      .from(bookingAssignments)
      .where(eq(bookingAssignments.id, parsed.data.assignmentId))
      .limit(1);
    if (!assignment) return { ok: false as const, error: 'not_found' };
    if (assignment.driverId !== me.id) return { ok: false as const, error: 'forbidden' };
    if (assignment.status !== 'offered') return { ok: false as const, error: 'invalid_status' };

    await tx
      .update(bookingAssignments)
      .set({ status: 'declined', declineReason: parsed.data.reason })
      .where(eq(bookingAssignments.id, parsed.data.assignmentId));

    // Send the booking back to `approved` so the manager can re-dispatch.
    await tx
      .update(bookings)
      .set({ status: 'approved', updatedAt: new Date() })
      .where(
        and(eq(bookings.id, assignment.bookingId), eq(bookings.status, 'dispatched')),
      );

    await tx.insert(bookingEvents).values({
      bookingId: assignment.bookingId,
      actorUserId: me.id,
      kind: 'driver_declined',
      payload: { assignmentId: parsed.data.assignmentId, reason: parsed.data.reason },
    });

    revalidatePath('/driver');
    revalidatePath(`/manager/bookings`);
    return { ok: true as const };
  });
}
