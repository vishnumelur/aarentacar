import { pgTable, uuid, integer, timestamp, index } from 'drizzle-orm/pg-core';
import { bookings } from './bookings';
import { addons } from './addons';

export const bookingAddons = pgTable(
  'booking_addons',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    bookingId: uuid('booking_id')
      .notNull()
      .references(() => bookings.id, { onDelete: 'cascade' }),
    addonId: uuid('addon_id')
      .notNull()
      .references(() => addons.id, { onDelete: 'restrict' }),
    quantity: integer('quantity').notNull().default(1),
    unitPriceAed: integer('unit_price_aed').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('booking_addons_booking_idx').on(table.bookingId)],
);

export type BookingAddon = typeof bookingAddons.$inferSelect;
export type NewBookingAddon = typeof bookingAddons.$inferInsert;
