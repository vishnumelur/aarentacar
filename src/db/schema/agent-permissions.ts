import { pgTable, uuid, boolean, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';

/**
 * Fine-grained sub-permissions for users with role=agent. One row per agent
 * user (1:1 with users). Managers/superadmins implicitly have every
 * permission and do not need a row here. Absence of a row means the agent has
 * no elevated permissions beyond baseline manager-portal read access.
 */
export const agentPermissions = pgTable('agent_permissions', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  canApproveBookings: boolean('can_approve_bookings').notNull().default(false),
  canReviewKyc: boolean('can_review_kyc').notNull().default(false),
  canEditPricing: boolean('can_edit_pricing').notNull().default(false),
  canManagePromos: boolean('can_manage_promos').notNull().default(false),
  canViewRevenue: boolean('can_view_revenue').notNull().default(false),
  canManageDrivers: boolean('can_manage_drivers').notNull().default(false),
  canEditSettings: boolean('can_edit_settings').notNull().default(false),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type AgentPermission = typeof agentPermissions.$inferSelect;
export type NewAgentPermission = typeof agentPermissions.$inferInsert;
