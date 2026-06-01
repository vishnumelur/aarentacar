import { pgTable, uuid, text, integer, timestamp, index } from 'drizzle-orm/pg-core';
import { vehicleCategories } from './vehicle-categories';

export const vehicleTypes = pgTable(
  'vehicle_types',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => vehicleCategories.id, { onDelete: 'restrict' }),
    slug: text('slug').notNull().unique(),
    nameEn: text('name_en').notNull(),
    nameAr: text('name_ar').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('vehicle_types_category_idx').on(table.categoryId)],
);

export type VehicleType = typeof vehicleTypes.$inferSelect;
export type NewVehicleType = typeof vehicleTypes.$inferInsert;
