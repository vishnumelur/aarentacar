import {
  pgTable,
  uuid,
  text,
  integer,
  jsonb,
  pgEnum,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { bookings } from './bookings';

export const paymentMethodEnum = pgEnum('payment_method', [
  'card',
  'tabby',
  'cod',
  'bank_transfer',
]);

export const paymentStatusEnum = pgEnum('payment_status', [
  'initiated',
  'succeeded',
  'failed',
  'refunded',
  'manual_pending',
]);

/**
 * One row per payment attempt against a booking. `gatewayRef` holds the
 * provider intent/session id (Stripe PaymentIntent id, Tabby session id, or a
 * manual reference for COD / bank transfer). `rawResponse` snapshots the latest
 * provider payload for audit.
 */
export const payments = pgTable(
  'payments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    bookingId: uuid('booking_id')
      .notNull()
      .references(() => bookings.id, { onDelete: 'cascade' }),
    method: paymentMethodEnum('method').notNull(),
    gatewayRef: text('gateway_ref'),
    amountAed: integer('amount_aed').notNull(),
    currency: text('currency').notNull().default('AED'),
    status: paymentStatusEnum('status').notNull().default('initiated'),
    capturedAt: timestamp('captured_at', { withTimezone: true }),
    rawResponse: jsonb('raw_response'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('payments_booking_idx').on(table.bookingId),
    index('payments_gateway_ref_idx').on(table.gatewayRef),
    index('payments_status_idx').on(table.status),
  ],
);

export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;
