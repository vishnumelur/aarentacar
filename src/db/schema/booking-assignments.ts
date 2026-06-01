import { pgTable, uuid, text, timestamp, pgEnum, index } from 'drizzle-orm/pg-core';
import { bookings } from './bookings';
import { users } from './users';

export const assignmentStatusEnum = pgEnum('assignment_status', [
  'offered',
  'accepted',
  'declined',
  'reassigned',
]);

export const bookingAssignments = pgTable(
  'booking_assignments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    bookingId: uuid('booking_id')
      .notNull()
      .references(() => bookings.id, { onDelete: 'cascade' }),
    driverId: uuid('driver_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    assignedByUserId: uuid('assigned_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    status: assignmentStatusEnum('status').notNull().default('offered'),
    declineReason: text('decline_reason'),
    assignedAt: timestamp('assigned_at', { withTimezone: true }).defaultNow().notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  },
  (table) => [
    index('booking_assignments_booking_idx').on(table.bookingId),
    index('booking_assignments_driver_idx').on(table.driverId),
    index('booking_assignments_status_idx').on(table.status),
  ],
);

export type BookingAssignment = typeof bookingAssignments.$inferSelect;
export type NewBookingAssignment = typeof bookingAssignments.$inferInsert;
