import { pgTable, uuid, text, timestamp, pgEnum, index } from 'drizzle-orm/pg-core';

export const userRoleEnum = pgEnum('user_role', [
  'customer',
  'driver',
  'agent',
  'manager',
  'superadmin',
]);

export const languageEnum = pgEnum('language', ['en', 'ar']);

export const verificationStatusEnum = pgEnum('verification_status', [
  'unverified',
  'pending',
  'verified',
  'rejected',
]);

export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    fullName: text('full_name').notNull(),
    phone: text('phone'),
    role: userRoleEnum('role').notNull().default('customer'),
    preferredLanguage: languageEnum('preferred_language').notNull().default('en'),
    verificationStatus: verificationStatusEnum('verification_status')
      .notNull()
      .default('unverified'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    index('users_email_idx').on(table.email),
    index('users_role_idx').on(table.role),
  ],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
