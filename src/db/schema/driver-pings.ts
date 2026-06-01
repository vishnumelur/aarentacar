import {
  pgTable,
  uuid,
  integer,
  doublePrecision,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { users } from './users';
import { bookings } from './bookings';

export const driverPings = pgTable(
  'driver_pings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    driverId: uuid('driver_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    bookingId: uuid('booking_id').references(() => bookings.id, { onDelete: 'set null' }),
    lat: doublePrecision('lat').notNull(),
    lng: doublePrecision('lng').notNull(),
    heading: integer('heading'),
    speed: doublePrecision('speed'),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('driver_pings_driver_recorded_at_idx').on(table.driverId, table.recordedAt),
  ],
);

export type DriverPing = typeof driverPings.$inferSelect;
export type NewDriverPing = typeof driverPings.$inferInsert;
