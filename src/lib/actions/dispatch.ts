'use server';

import { and, asc, eq, inArray, ne } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import {
  bookings,
  bookingEvents,
  auditLogs,
  driverProfiles,
  bookingAssignments,
  users,
} from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { userCanAgent } from '@/lib/auth/agent-guard';
import { haversineKm } from '@/lib/geo/distance';
import { createNotification } from '@/lib/notifications/create';

export type ApproveOutcome =
  | { ok: true }
  | { ok: false; error: 'forbidden' | 'invalid_input' | 'not_found' | 'invalid_status' };

export async function approveBooking(formData: FormData): Promise<ApproveOutcome> {
  const user = await getCurrentUser();
  if (!user || !(await userCanAgent(user, 'approve_bookings'))) {
    return { ok: false, error: 'forbidden' };
  }
  const id = String(formData.get('id') ?? '');
  if (!id) return { ok: false, error: 'invalid_input' };

  return await db.transaction(async (tx) => {
    const [booking] = await tx.select().from(bookings).where(eq(bookings.id, id)).limit(1);
    if (!booking) return { ok: false as const, error: 'not_found' };
    if (booking.status !== 'pending_approval') {
      return { ok: false as const, error: 'invalid_status' };
    }

    await tx
      .update(bookings)
      .set({ status: 'approved', updatedAt: new Date() })
      .where(eq(bookings.id, id));

    await tx.insert(bookingEvents).values({
      bookingId: id,
      actorUserId: user.id,
      kind: 'approved',
      payload: { code: booking.code },
    });

    await tx.insert(auditLogs).values({
      actorUserId: user.id,
      action: 'booking.approved',
      targetType: 'booking',
      targetId: id,
      payload: { code: booking.code },
    });

    // In-app inbox notification for the customer. Best-effort.
    // TODO(Plan #11): move to pg-boss async enqueue.
    try {
      await createNotification({
        userId: booking.customerId,
        kind: 'booking_approved',
        title: 'Your booking is approved',
        body: `Booking ${booking.code} has been approved.`,
        payload: { code: booking.code, bookingId: id },
      });
    } catch (err) {
      console.warn('approveBooking notification failed', err);
    }

    revalidatePath(`/manager/bookings/${booking.code}`);
    revalidatePath('/manager/bookings');
    revalidatePath(`/my-bookings/${booking.code}`);
    return { ok: true as const };
  });
}

export type RejectOutcome =
  | { ok: true }
  | {
      ok: false;
      error:
        | 'forbidden'
        | 'invalid_input'
        | 'not_found'
        | 'invalid_status'
        | 'reason_required';
    };

export async function rejectBooking(formData: FormData): Promise<RejectOutcome> {
  const user = await getCurrentUser();
  if (!user || !(await userCanAgent(user, 'approve_bookings'))) {
    return { ok: false, error: 'forbidden' };
  }
  const id = String(formData.get('id') ?? '');
  const reason = String(formData.get('reason') ?? '').trim();
  if (!id) return { ok: false, error: 'invalid_input' };
  if (!reason) return { ok: false, error: 'reason_required' };
  if (reason.length > 500) return { ok: false, error: 'invalid_input' };

  return await db.transaction(async (tx) => {
    const [booking] = await tx.select().from(bookings).where(eq(bookings.id, id)).limit(1);
    if (!booking) return { ok: false as const, error: 'not_found' };
    if (booking.status !== 'pending_approval') {
      return { ok: false as const, error: 'invalid_status' };
    }

    await tx
      .update(bookings)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(eq(bookings.id, id));

    await tx.insert(bookingEvents).values({
      bookingId: id,
      actorUserId: user.id,
      kind: 'rejected',
      payload: { code: booking.code, reason },
    });

    await tx.insert(auditLogs).values({
      actorUserId: user.id,
      action: 'booking.rejected',
      targetType: 'booking',
      targetId: id,
      payload: { code: booking.code, reason },
    });

    revalidatePath(`/manager/bookings/${booking.code}`);
    revalidatePath('/manager/bookings');
    revalidatePath(`/my-bookings/${booking.code}`);
    // Refund flow will land in Plan #7 when payments are wired
    return { ok: true as const };
  });
}

export interface DriverSuggestion {
  userId: string;
  fullName: string;
  photoUrl: string | null;
  status: 'available' | 'on_duty' | 'off_duty' | 'suspended';
  distanceKm: number | null;
  lastPingMinutesAgo: number | null;
}

export type SuggestOutcome =
  | { ok: true; suggestions: DriverSuggestion[] }
  | { ok: false; error: 'forbidden' | 'invalid_input' | 'not_found' | 'no_pickup_coords' };

export async function suggestDrivers(input: { bookingId: string }): Promise<SuggestOutcome> {
  const user = await getCurrentUser();
  if (!user || !(await userCanAgent(user, 'manage_drivers'))) {
    return { ok: false, error: 'forbidden' };
  }
  if (!input.bookingId) return { ok: false, error: 'invalid_input' };

  const [booking] = await db.select().from(bookings).where(eq(bookings.id, input.bookingId)).limit(1);
  if (!booking) return { ok: false, error: 'not_found' };

  // Identify drivers already assigned to other ACTIVE bookings (offered/accepted)
  const activeAssignments = await db
    .select({ driverId: bookingAssignments.driverId })
    .from(bookingAssignments)
    .where(
      and(
        ne(bookingAssignments.bookingId, input.bookingId),
        inArray(bookingAssignments.status, ['offered', 'accepted']),
      ),
    );
  const busyIds = new Set(activeAssignments.map((a) => a.driverId));

  // Candidate drivers: status='available', not in busyIds. Join users for display.
  const candidates = await db
    .select({
      userId: driverProfiles.userId,
      status: driverProfiles.status,
      currentLat: driverProfiles.currentLat,
      currentLng: driverProfiles.currentLng,
      lastPingAt: driverProfiles.lastPingAt,
      photoUrl: driverProfiles.photoUrl,
      fullName: users.fullName,
    })
    .from(driverProfiles)
    .innerJoin(users, eq(users.id, driverProfiles.userId))
    .where(eq(driverProfiles.status, 'available'))
    .orderBy(asc(users.fullName));

  const available = candidates.filter((c) => !busyIds.has(c.userId));

  const now = Date.now();
  const suggestions: DriverSuggestion[] = available.map((c) => {
    let distanceKm: number | null = null;
    if (
      booking.pickupLat !== null &&
      booking.pickupLng !== null &&
      c.currentLat !== null &&
      c.currentLng !== null
    ) {
      distanceKm = haversineKm(
        { lat: c.currentLat, lng: c.currentLng },
        { lat: booking.pickupLat, lng: booking.pickupLng },
      );
    }
    const lastPingMinutesAgo = c.lastPingAt
      ? Math.floor((now - c.lastPingAt.getTime()) / 60_000)
      : null;
    return {
      userId: c.userId,
      fullName: c.fullName,
      photoUrl: c.photoUrl,
      status: c.status,
      distanceKm,
      lastPingMinutesAgo,
    };
  });

  // Sort: drivers with known distance first (ascending), then nameless fallback
  suggestions.sort((a, b) => {
    if (a.distanceKm === null && b.distanceKm === null) return 0;
    if (a.distanceKm === null) return 1;
    if (b.distanceKm === null) return -1;
    return a.distanceKm - b.distanceKm;
  });

  // Cap to top 5
  return { ok: true, suggestions: suggestions.slice(0, 5) };
}

export type DispatchOutcome =
  | { ok: true; assignmentId: string }
  | {
      ok: false;
      error:
        | 'forbidden'
        | 'invalid_input'
        | 'not_found'
        | 'invalid_status'
        | 'driver_not_available'
        | 'driver_busy';
    };

export async function dispatchDriver(input: {
  bookingId: string;
  driverUserId: string;
}): Promise<DispatchOutcome> {
  const user = await getCurrentUser();
  if (!user || !(await userCanAgent(user, 'manage_drivers'))) {
    return { ok: false, error: 'forbidden' };
  }
  if (!input.bookingId || !input.driverUserId) {
    return { ok: false, error: 'invalid_input' };
  }

  const result: DispatchOutcome = await db.transaction(async (tx): Promise<DispatchOutcome> => {
    const [booking] = await tx.select().from(bookings).where(eq(bookings.id, input.bookingId)).limit(1);
    if (!booking) return { ok: false as const, error: 'not_found' };
    if (booking.status !== 'approved') {
      return { ok: false as const, error: 'invalid_status' };
    }

    const [profile] = await tx
      .select()
      .from(driverProfiles)
      .where(eq(driverProfiles.userId, input.driverUserId))
      .limit(1);
    if (!profile) return { ok: false as const, error: 'not_found' };
    if (profile.status !== 'available') {
      return { ok: false as const, error: 'driver_not_available' };
    }

    // Race-condition recheck: driver must not already be on a different active assignment
    const busy = await tx
      .select({ id: bookingAssignments.id })
      .from(bookingAssignments)
      .where(
        and(
          eq(bookingAssignments.driverId, input.driverUserId),
          ne(bookingAssignments.bookingId, input.bookingId),
          inArray(bookingAssignments.status, ['offered', 'accepted']),
        ),
      )
      .limit(1);
    if (busy.length > 0) return { ok: false as const, error: 'driver_busy' };

    const [assignment] = await tx
      .insert(bookingAssignments)
      .values({
        bookingId: input.bookingId,
        driverId: input.driverUserId,
        assignedByUserId: user.id,
        status: 'offered',
      })
      .returning({ id: bookingAssignments.id });
    if (!assignment) return { ok: false as const, error: 'invalid_input' };

    await tx
      .update(bookings)
      .set({ status: 'dispatched', updatedAt: new Date() })
      .where(eq(bookings.id, input.bookingId));

    await tx.insert(bookingEvents).values({
      bookingId: input.bookingId,
      actorUserId: user.id,
      kind: 'dispatched',
      payload: { driverUserId: input.driverUserId, assignmentId: assignment.id },
    });

    await tx.insert(auditLogs).values({
      actorUserId: user.id,
      action: 'booking.dispatched',
      targetType: 'booking',
      targetId: input.bookingId,
      payload: { code: booking.code, driverUserId: input.driverUserId },
    });

    revalidatePath(`/manager/bookings/${booking.code}`);
    revalidatePath('/manager/bookings');
    return { ok: true as const, assignmentId: assignment.id };
  });

  if (result.ok) {
    // Fire web push outside the transaction — best effort, errors swallowed so a push
    // failure never rolls back a successful dispatch.
    try {
      const { sendToUser } = await import('@/lib/push/send');
      const [bk] = await db
        .select({
          code: bookings.code,
          pickupAt: bookings.pickupAt,
          address: bookings.pickupAddress,
        })
        .from(bookings)
        .where(eq(bookings.id, input.bookingId))
        .limit(1);
      if (bk) {
        const when = new Date(bk.pickupAt).toLocaleString();
        await sendToUser(input.driverUserId, {
          title: 'New job assigned',
          body: `${bk.code} · Pickup at ${bk.address} on ${when}`,
          url: `/driver/jobs/${result.assignmentId}`,
        });
        // In-app inbox notification too. TODO(Plan #11): move to pg-boss.
        await createNotification({
          userId: input.driverUserId,
          kind: 'job_assigned',
          title: 'New job assigned',
          body: `${bk.code} · Pickup at ${bk.address} on ${when}`,
          payload: { code: bk.code, assignmentId: result.assignmentId },
        });
      }
    } catch (err) {
      console.warn('dispatch push fire failed', err);
    }
  }

  return result;
}
