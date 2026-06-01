import {
  pgTable,
  uuid,
  text,
  date,
  doublePrecision,
  timestamp,
  integer,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { users } from './users';

export const driverStatusEnum = pgEnum('driver_status', [
  'available',
  'on_duty',
  'off_duty',
  'suspended',
]);

export const driverProfiles = pgTable('driver_profiles', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  licenseNo: text('license_no').notNull(),
  licenseExpiry: date('license_expiry').notNull(),
  status: driverStatusEnum('status').notNull().default('off_duty'),
  currentLat: doublePrecision('current_lat'),
  currentLng: doublePrecision('current_lng'),
  lastPingAt: timestamp('last_ping_at', { withTimezone: true }),
  ratingAvg: integer('rating_avg'),
  photoUrl: text('photo_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type DriverProfile = typeof driverProfiles.$inferSelect;
export type NewDriverProfile = typeof driverProfiles.$inferInsert;
