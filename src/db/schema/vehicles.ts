import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  pgEnum,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { vehicleTypes } from './vehicle-types';
import { branches } from './branches';

export const vehicleStatusEnum = pgEnum('vehicle_status', ['active', 'maintenance', 'retired']);

export const transmissionEnum = pgEnum('transmission', ['automatic', 'manual']);

export const fuelTypeEnum = pgEnum('fuel_type', ['petrol', 'diesel', 'hybrid', 'electric']);

export const vehicles = pgTable(
  'vehicles',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    typeId: uuid('type_id')
      .notNull()
      .references(() => vehicleTypes.id, { onDelete: 'restrict' }),
    branchId: uuid('branch_id').references(() => branches.id, { onDelete: 'set null' }),
    make: text('make').notNull(),
    model: text('model').notNull(),
    year: integer('year').notNull(),
    plate: text('plate').notNull().unique(),
    color: text('color'),
    transmission: transmissionEnum('transmission').notNull().default('automatic'),
    seats: integer('seats').notNull().default(5),
    doors: integer('doors').notNull().default(4),
    fuelType: fuelTypeEnum('fuel_type').notNull().default('petrol'),
    features: jsonb('features').$type<string[]>().default([]).notNull(),
    status: vehicleStatusEnum('status').notNull().default('active'),
    primaryPhotoUrl: text('primary_photo_url'),
    photos: jsonb('photos').$type<string[]>().default([]).notNull(),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    index('vehicles_type_idx').on(table.typeId),
    index('vehicles_status_idx').on(table.status),
    index('vehicles_branch_idx').on(table.branchId),
  ],
);

export type Vehicle = typeof vehicles.$inferSelect;
export type NewVehicle = typeof vehicles.$inferInsert;
