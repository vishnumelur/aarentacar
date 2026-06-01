import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';
import { bookings } from './bookings';

export const agreements = pgTable('agreements', {
  id: uuid('id').defaultRandom().primaryKey(),
  bookingId: uuid('booking_id')
    .notNull()
    .unique()
    .references(() => bookings.id, { onDelete: 'cascade' }),
  pdfUrl: text('pdf_url').notNull(),
  customerSignatureImageUrl: text('customer_signature_image_url'),
  generatedAt: timestamp('generated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type Agreement = typeof agreements.$inferSelect;
export type NewAgreement = typeof agreements.$inferInsert;
