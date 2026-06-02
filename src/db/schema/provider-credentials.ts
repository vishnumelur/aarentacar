import {
  pgTable,
  uuid,
  text,
  pgEnum,
  timestamp,
  customType,
  unique,
} from 'drizzle-orm/pg-core';
import { users } from './users';

/**
 * Postgres `bytea` mapped to a Node Buffer. We store the AES-256-GCM blob
 * (iv + tag + ciphertext) as true binary so a DB dump alone is useless without
 * the ENCRYPTION_KEY. postgres-js already returns bytea as a Buffer and accepts
 * a Buffer on insert, so the codec is an identity pass-through.
 */
export const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return 'bytea';
  },
  toDriver(value: Buffer): Buffer {
    return value;
  },
  fromDriver(value: Buffer): Buffer {
    return value;
  },
});

export const credentialProviderEnum = pgEnum('credential_provider', [
  'stripe',
  'tabby',
  'mapbox',
  'smtp',
  // Observability DSN providers (Plan #13). GlitchTip is Sentry-API-compatible.
  'glitchtip',
  'sentry',
]);

export const credentialEnvEnum = pgEnum('credential_env', ['live', 'test']);

export const providerCredentials = pgTable(
  'provider_credentials',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    provider: credentialProviderEnum('provider').notNull(),
    env: credentialEnvEnum('env').notNull().default('live'),
    keyName: text('key_name').notNull(),
    valueEncrypted: bytea('value_encrypted').notNull(),
    // Masked hint for the UI, e.g. "••1234". Never the full secret.
    lastFour: text('last_four'),
    updatedByUserId: uuid('updated_by_user_id').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('provider_credentials_provider_env_key_uq').on(
      table.provider,
      table.env,
      table.keyName,
    ),
  ],
);

export type ProviderCredential = typeof providerCredentials.$inferSelect;
export type NewProviderCredential = typeof providerCredentials.$inferInsert;
