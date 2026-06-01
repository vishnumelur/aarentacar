import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  jsonb,
  pgEnum,
  timestamp,
} from 'drizzle-orm/pg-core';

export const promoKindEnum = pgEnum('promo_kind', ['percent', 'fixed']);

export const promoCodes = pgTable('promo_codes', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: text('code').notNull().unique(),
  kind: promoKindEnum('kind').notNull(),
  value: integer('value').notNull(),
  minAmountAed: integer('min_amount_aed').notNull().default(0),
  maxUses: integer('max_uses'),
  usedCount: integer('used_count').notNull().default(0),
  validFrom: timestamp('valid_from', { withTimezone: true }).defaultNow().notNull(),
  validTo: timestamp('valid_to', { withTimezone: true }),
  appliesToCategories: jsonb('applies_to_categories').$type<string[] | null>(),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type PromoCode = typeof promoCodes.$inferSelect;
export type NewPromoCode = typeof promoCodes.$inferInsert;
