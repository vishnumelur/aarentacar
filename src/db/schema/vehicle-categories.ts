import { pgTable, uuid, text, integer, timestamp } from 'drizzle-orm/pg-core';

export const vehicleCategories = pgTable('vehicle_categories', {
  id: uuid('id').defaultRandom().primaryKey(),
  slug: text('slug').notNull().unique(),
  nameEn: text('name_en').notNull(),
  nameAr: text('name_ar').notNull(),
  advanceBookMinDays: integer('advance_book_min_days').notNull().default(0),
  minDriverAge: integer('min_driver_age').notNull().default(21),
  defaultDepositAed: integer('default_deposit_aed').notNull().default(1000),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type VehicleCategory = typeof vehicleCategories.$inferSelect;
export type NewVehicleCategory = typeof vehicleCategories.$inferInsert;
