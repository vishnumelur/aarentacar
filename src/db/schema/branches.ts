import { pgTable, uuid, text, doublePrecision, boolean, timestamp } from 'drizzle-orm/pg-core';

export const branches = pgTable('branches', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull().unique(),
  address: text('address').notNull(),
  lat: doublePrecision('lat'),
  lng: doublePrecision('lng'),
  phone: text('phone'),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type Branch = typeof branches.$inferSelect;
export type NewBranch = typeof branches.$inferInsert;
