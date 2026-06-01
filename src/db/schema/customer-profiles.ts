import { pgTable, uuid, text, date, integer, pgEnum, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';

export const residencyEnum = pgEnum('residency', ['tourist', 'resident']);

export const customerProfiles = pgTable('customer_profiles', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  residency: residencyEnum('residency').notNull(),
  dateOfBirth: date('date_of_birth').notNull(),
  nationality: text('nationality').notNull(),
  loyaltyPoints: integer('loyalty_points').notNull().default(0),
  lifetimeBookings: integer('lifetime_bookings').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type CustomerProfile = typeof customerProfiles.$inferSelect;
export type NewCustomerProfile = typeof customerProfiles.$inferInsert;
