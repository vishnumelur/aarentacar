import { pgTable, uuid, text, date, pgEnum, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users';

export const documentTypeEnum = pgEnum('document_type', [
  'passport',
  'visa',
  'emirates_id_front',
  'emirates_id_back',
  'driving_license_front',
  'driving_license_back',
  'international_permit',
]);

export const documentStatusEnum = pgEnum('document_status', [
  'pending',
  'approved',
  'rejected',
  'expired',
  'withdrawn',
]);

export const customerDocuments = pgTable(
  'customer_documents',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: documentTypeEnum('type').notNull(),
    fileUrl: text('file_url').notNull(),
    expiryDate: date('expiry_date'),
    status: documentStatusEnum('status').notNull().default('pending'),
    reviewerId: uuid('reviewer_id').references(() => users.id),
    reviewNote: text('review_note'),
    uploadedAt: timestamp('uploaded_at', { withTimezone: true }).defaultNow().notNull(),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  },
  (table) => [
    index('customer_documents_customer_idx').on(table.customerId),
    index('customer_documents_status_idx').on(table.status),
  ],
);

export type CustomerDocument = typeof customerDocuments.$inferSelect;
export type NewCustomerDocument = typeof customerDocuments.$inferInsert;
