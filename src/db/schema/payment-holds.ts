import {
  pgTable,
  uuid,
  text,
  integer,
  pgEnum,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { bookings } from './bookings';

export const paymentHoldStatusEnum = pgEnum('payment_hold_status', [
  'held',
  'released',
  'captured',
  'partially_captured',
]);

/**
 * Refundable security deposit held via a Stripe manual-capture PaymentIntent.
 * Placed at booking time on card payments. Auto-released ~1h after a clean
 * return inspection (Plan #11 job) or captured (full/partial) by a manager.
 */
export const paymentHolds = pgTable(
  'payment_holds',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    bookingId: uuid('booking_id')
      .notNull()
      .references(() => bookings.id, { onDelete: 'cascade' }),
    gatewayRef: text('gateway_ref'),
    amountAed: integer('amount_aed').notNull(),
    capturedAmountAed: integer('captured_amount_aed').notNull().default(0),
    currency: text('currency').notNull().default('AED'),
    status: paymentHoldStatusEnum('status').notNull().default('held'),
    releasedAt: timestamp('released_at', { withTimezone: true }),
    capturedAt: timestamp('captured_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('payment_holds_booking_idx').on(table.bookingId),
    index('payment_holds_gateway_ref_idx').on(table.gatewayRef),
  ],
);

export type PaymentHold = typeof paymentHolds.$inferSelect;
export type NewPaymentHold = typeof paymentHolds.$inferInsert;
