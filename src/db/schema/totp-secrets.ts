import { pgTable, uuid, jsonb, timestamp, integer } from 'drizzle-orm/pg-core';
import { users } from './users';
import { bytea } from './provider-credentials';

/**
 * Per-user TOTP 2FA secret (Plan #11). One row per user (unique). The secret is
 * encrypted at rest; `enabledAt` is set only once the user confirms a first
 * code. `recoveryCodesHashed` holds 10 bcrypt hashes, single-use (removed as
 * consumed). Mandatory for super-admins at login.
 */
export const totpSecrets = pgTable('totp_secrets', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  secretEncrypted: bytea('secret_encrypted').notNull(),
  recoveryCodesHashed: jsonb('recovery_codes_hashed').$type<string[]>().notNull().default([]),
  enabledAt: timestamp('enabled_at', { withTimezone: true }),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  // Highest TOTP time-step counter that has been accepted at login. A code whose
  // counter is <= this value is a replay and is rejected.
  lastUsedCounter: integer('last_used_counter'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type TotpSecret = typeof totpSecrets.$inferSelect;
export type NewTotpSecret = typeof totpSecrets.$inferInsert;
