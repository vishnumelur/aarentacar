/**
 * Pure availability check. Given the set of existing bookings on a
 * specific vehicle, determine whether a new window overlaps with any
 * active booking.
 *
 * "Active" = anything from `pending_payment` through `in_progress`.
 * Completed / cancelled / refunded bookings don't block.
 *
 * Adjacent windows (return_at of one equals pickup_at of the next) are
 * allowed — a same-day swap between two customers is fine in practice.
 */

import type { Booking } from '@/db/schema';

export type BookingStatusForOverlap = Booking['status'];

const ACTIVE_STATUSES: ReadonlyArray<BookingStatusForOverlap> = [
  'pending_payment',
  'pending_approval',
  'approved',
  'dispatched',
  'in_progress',
];

export interface AvailabilityWindow {
  vehicleId: string;
  pickupAt: Date;
  returnAt: Date;
}

export interface ExistingBooking {
  vehicleId: string;
  pickupAt: Date;
  returnAt: Date;
  status: BookingStatusForOverlap;
}

export function isActiveBookingStatus(status: BookingStatusForOverlap): boolean {
  return ACTIVE_STATUSES.includes(status);
}

export function hasOverlap(
  existing: ExistingBooking[],
  request: AvailabilityWindow,
): boolean {
  return existing.some(
    (b) =>
      b.vehicleId === request.vehicleId &&
      isActiveBookingStatus(b.status) &&
      b.pickupAt < request.returnAt &&
      b.returnAt > request.pickupAt,
  );
}
