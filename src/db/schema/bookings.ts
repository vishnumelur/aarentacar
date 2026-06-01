import {
  pgTable,
  uuid,
  text,
  integer,
  doublePrecision,
  pgEnum,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { users } from './users';
import { vehicles } from './vehicles';

export const bookingStatusEnum = pgEnum('booking_status', [
  'draft',
  'pending_kyc',
  'pending_payment',
  'pending_approval',
  'approved',
  'dispatched',
  'in_progress',
  'completed',
  'cancelled',
  'refunded',
]);

export const rentalKindEnum = pgEnum('rental_kind', ['self_drive', 'chauffeur']);

export const bookings = pgTable(
  'bookings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    code: text('code').notNull().unique(),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    vehicleId: uuid('vehicle_id')
      .notNull()
      .references(() => vehicles.id, { onDelete: 'restrict' }),
    rentalKind: rentalKindEnum('rental_kind').notNull(),
    pickupAt: timestamp('pickup_at', { withTimezone: true }).notNull(),
    returnAt: timestamp('return_at', { withTimezone: true }).notNull(),
    pickupLat: doublePrecision('pickup_lat'),
    pickupLng: doublePrecision('pickup_lng'),
    pickupAddress: text('pickup_address').notNull(),
    returnAddress: text('return_address'),
    status: bookingStatusEnum('status').notNull().default('draft'),
    subtotalAed: integer('subtotal_aed').notNull(),
    addonsAed: integer('addons_aed').notNull().default(0),
    discountAed: integer('discount_aed').notNull().default(0),
    depositAed: integer('deposit_aed').notNull(),
    totalAed: integer('total_aed').notNull(),
    appliedPromoCode: text('applied_promo_code'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('bookings_customer_idx').on(table.customerId),
    index('bookings_vehicle_idx').on(table.vehicleId),
    index('bookings_status_idx').on(table.status),
    index('bookings_pickup_at_idx').on(table.pickupAt),
  ],
);

export type Booking = typeof bookings.$inferSelect;
export type NewBooking = typeof bookings.$inferInsert;
