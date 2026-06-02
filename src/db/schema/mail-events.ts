import { pgTable, uuid, text, jsonb, pgEnum, timestamp, index } from 'drizzle-orm/pg-core';

/**
 * Mail delivery accounting (Plan #12, Task 10).
 *
 * One row per send-email attempt and per parsed Postfix log status. The
 * worker's `send-email` handler inserts a `queued`/`sent`/`failed` row when it
 * processes a job; the nightly bounce-log parser (verify-on-deploy) adds
 * `bounced`/`deferred` rows from Postfix's accounting log. The Super-Admin
 * System page reads aggregate counts from here for the deliverability card.
 */
export const mailEventStatusEnum = pgEnum('mail_event_status', [
  'queued',
  'sent',
  'failed',
  'bounced',
  'deferred',
]);

export const mailEvents = pgTable(
  'mail_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    toAddress: text('to_address').notNull(),
    template: text('template').notNull(),
    locale: text('locale').notNull().default('en'),
    status: mailEventStatusEnum('status').notNull(),
    // Postfix/SMTP message-id once accepted by the relay, when known.
    messageId: text('message_id'),
    // Failure reason or Postfix status detail (verify-on-deploy log parser).
    detail: text('detail'),
    payload: jsonb('payload').$type<Record<string, unknown> | null>(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('mail_events_status_idx').on(table.status),
    index('mail_events_created_at_idx').on(table.createdAt),
  ],
);

export type MailEvent = typeof mailEvents.$inferSelect;
export type NewMailEvent = typeof mailEvents.$inferInsert;
