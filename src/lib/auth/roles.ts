export type Role = 'customer' | 'driver' | 'agent' | 'manager' | 'superadmin';
export type Portal = 'public' | 'customer' | 'driver' | 'manager' | 'superadmin';

/**
 * URL path segment each portal's rewritten requests land on.
 * Empty string = no rewrite (lives at root of the public subdomain).
 */
export const PORTAL_TO_SEGMENT: Record<Portal, string> = {
  public: '',
  customer: '',
  driver: 'driver',
  manager: 'manager',
  superadmin: 'admin',
};

const ACCESS: Record<Role, Portal[]> = {
  customer: ['public', 'customer'],
  driver: ['public', 'driver'],
  agent: ['public', 'customer', 'manager'],
  manager: ['public', 'customer', 'manager'],
  superadmin: ['public', 'customer', 'driver', 'manager', 'superadmin'],
};

export function canAccessPortal(role: Role, portal: Portal): boolean {
  return ACCESS[role].includes(portal);
}

/**
 * Fine-grained agent sub-permissions. The string keys map 1:1 to the boolean
 * columns on the `agent_permissions` table (see schema). Managers and
 * superadmins implicitly hold every permission; agents must have the matching
 * column set to true.
 */
export type AgentPermissionKey =
  | 'approve_bookings'
  | 'review_kyc'
  | 'edit_pricing'
  | 'manage_promos'
  | 'view_revenue'
  | 'manage_drivers'
  | 'edit_settings';

/** Subset of the `agent_permissions` row that `canAgent` reads. */
export interface AgentPermissionFlags {
  canApproveBookings: boolean;
  canReviewKyc: boolean;
  canEditPricing: boolean;
  canManagePromos: boolean;
  canViewRevenue: boolean;
  canManageDrivers: boolean;
  canEditSettings: boolean;
}

const PERMISSION_COLUMN: Record<AgentPermissionKey, keyof AgentPermissionFlags> = {
  approve_bookings: 'canApproveBookings',
  review_kyc: 'canReviewKyc',
  edit_pricing: 'canEditPricing',
  manage_promos: 'canManagePromos',
  view_revenue: 'canViewRevenue',
  manage_drivers: 'canManageDrivers',
  edit_settings: 'canEditSettings',
};

/**
 * Pure permission check. `perms` is the agent's row from `agent_permissions`
 * (or null if none exists). Managers/superadmins always pass; agents pass only
 * when their matching flag is set; all other roles fail.
 */
export function canAgent(
  role: Role,
  permission: AgentPermissionKey,
  perms: AgentPermissionFlags | null,
): boolean {
  if (role === 'manager' || role === 'superadmin') return true;
  if (role !== 'agent') return false;
  if (!perms) return false;
  return perms[PERMISSION_COLUMN[permission]] === true;
}

export function portalFromHost(host: string): Portal {
  const sub = host.split('.')[0]?.toLowerCase() ?? '';
  if (sub === 'manager') return 'manager';
  if (sub === 'driver') return 'driver';
  if (sub === 'admin') return 'superadmin';
  return 'public';
}
