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

export function portalFromHost(host: string): Portal {
  const sub = host.split('.')[0]?.toLowerCase() ?? '';
  if (sub === 'manager') return 'manager';
  if (sub === 'driver') return 'driver';
  if (sub === 'admin') return 'superadmin';
  return 'public';
}
