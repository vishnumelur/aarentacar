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
import { payments } from './payments';
import { users } from './users';

export const refundStatusEnum = pgEnum('refund_status', [
  'initiated',
  'succeeded',
  'failed',
]);

/**
 * A refund issued against a prior payment. Manager-triggered (issueRefund) or
 * cancellation-policy driven. `gatewayRef` holds the provider refund id.
 */
export const refunds = pgTable(
  'refunds',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    bookingId: uuid('booking_id')
      .notNull()
      .references(() => bookings.id, { onDelete: 'cascade' }),
    paymentId: uuid('payment_id').references(() => payments.id, { onDelete: 'set null' }),
    gatewayRef: text('gateway_ref'),
    amountAed: integer('amount_aed').notNull(),
    currency: text('currency').notNull().default('AED'),
    reason: text('reason'),
    status: refundStatusEnum('status').notNull().default('initiated'),
    issuedByUserId: uuid('issued_by_user_id').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('refunds_booking_idx').on(table.bookingId),
    index('refunds_payment_idx').on(table.paymentId),
  ],
);

export type Refund = typeof refunds.$inferSelect;
export type NewRefund = typeof refunds.$inferInsert;
