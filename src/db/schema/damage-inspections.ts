import { pgTable, uuid, integer, text, jsonb, pgEnum, timestamp, index } from 'drizzle-orm/pg-core';
import { bookings } from './bookings';
import { users } from './users';

export const inspectionStageEnum = pgEnum('inspection_stage', ['handover', 'return']);

export const damageInspections = pgTable(
  'damage_inspections',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    bookingId: uuid('booking_id')
      .notNull()
      .references(() => bookings.id, { onDelete: 'cascade' }),
    stage: inspectionStageEnum('stage').notNull(),
    photos: jsonb('photos').$type<string[]>().notNull(),
    odometer: integer('odometer'),
    fuelLevel: integer('fuel_level'), // 0-100 percent
    damageNotes: text('damage_notes'),
    damageEstimateAed: integer('damage_estimate_aed'),
    signatureImageUrl: text('signature_image_url'),
    signedByCustomerAt: timestamp('signed_by_customer_at', { withTimezone: true }),
    driverId: uuid('driver_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('damage_inspections_booking_idx').on(t.bookingId),
    index('damage_inspections_stage_idx').on(t.stage),
  ],
);

export type DamageInspection = typeof damageInspections.$inferSelect;
export type NewDamageInspection = typeof damageInspections.$inferInsert;
