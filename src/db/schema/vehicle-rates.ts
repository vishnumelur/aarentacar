import { pgTable, uuid, text, integer, timestamp, pgEnum, index } from 'drizzle-orm/pg-core';
import { vehicles } from './vehicles';

export const rateKindEnum = pgEnum('rate_kind', [
  'hourly',
  'daily',
  'weekly',
  'monthly',
  'package',
]);

export const vehicleRates = pgTable(
  'vehicle_rates',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    vehicleId: uuid('vehicle_id')
      .notNull()
      .references(() => vehicles.id, { onDelete: 'cascade' }),
    rateKind: rateKindEnum('rate_kind').notNull(),
    priceAed: integer('price_aed').notNull(),
    packageName: text('package_name'),
    packageHours: integer('package_hours'),
    packageDescription: text('package_description'),
    validFrom: timestamp('valid_from', { withTimezone: true }).defaultNow().notNull(),
    validTo: timestamp('valid_to', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('vehicle_rates_vehicle_idx').on(table.vehicleId)],
);

export type VehicleRate = typeof vehicleRates.$inferSelect;
export type NewVehicleRate = typeof vehicleRates.$inferInsert;
