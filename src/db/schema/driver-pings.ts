import {
  pgTable,
  uuid,
  integer,
  doublePrecision,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { driverProfiles } from './driver-profiles';
import { bookings } from './bookings';

export const driverPings = pgTable(
  'driver_pings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    // Anchor on driver_profiles.userId (unique) rather than users.id so
    // a ping requires the user to have a driver profile and cascades
    // tidy up if the profile is removed.
    driverId: uuid('driver_id')
      .notNull()
      .references(() => driverProfiles.userId, { onDelete: 'cascade' }),
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
