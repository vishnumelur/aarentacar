import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * Idempotency ledger for inbound provider webhooks. The primary key is
 * `<provider>:<event_id>` (e.g. `stripe:evt_123`). A row's presence means the
 * event has already been processed, so re-deliveries become no-ops.
 */
export const webhookEvents = pgTable('webhook_events', {
  id: text('id').primaryKey(),
  processedAt: timestamp('processed_at', { withTimezone: true }).defaultNow().notNull(),
});

export type WebhookEvent = typeof webhookEvents.$inferSelect;
export type NewWebhookEvent = typeof webhookEvents.$inferInsert;
