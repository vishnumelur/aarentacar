import { describe, it, expect } from 'vitest';
import { canAccessPortal, portalFromHost, PORTAL_TO_SEGMENT } from '@/lib/auth/roles';

describe('canAccessPortal', () => {
  it('lets a customer into customer portal only', () => {
    expect(canAccessPortal('customer', 'customer')).toBe(true);
    expect(canAccessPortal('customer', 'manager')).toBe(false);
    expect(canAccessPortal('customer', 'driver')).toBe(false);
    expect(canAccessPortal('customer', 'superadmin')).toBe(false);
  });

  it('lets a manager into manager + customer portals', () => {
    expect(canAccessPortal('manager', 'manager')).toBe(true);
    expect(canAccessPortal('manager', 'customer')).toBe(true);
    expect(canAccessPortal('manager', 'driver')).toBe(false);
  });

  it('lets superadmin into all portals', () => {
    expect(canAccessPortal('superadmin', 'customer')).toBe(true);
    expect(canAccessPortal('superadmin', 'manager')).toBe(true);
    expect(canAccessPortal('superadmin', 'driver')).toBe(true);
    expect(canAccessPortal('superadmin', 'superadmin')).toBe(true);
  });

  it('lets driver only into driver portal', () => {
    expect(canAccessPortal('driver', 'driver')).toBe(true);
    expect(canAccessPortal('driver', 'manager')).toBe(false);
  });

  it('agent inherits manager portal access', () => {
    expect(canAccessPortal('agent', 'manager')).toBe(true);
    expect(canAccessPortal('agent', 'superadmin')).toBe(false);
  });
});

describe('portalFromHost', () => {
  it('returns public for apex/www', () => {
    expect(portalFromHost('aa-rentacar.com')).toBe('public');
    expect(portalFromHost('www.aa-rentacar.com')).toBe('public');
  });
  it('returns manager/driver/superadmin for the matching subdomain', () => {
    expect(portalFromHost('manager.aa-rentacar.com')).toBe('manager');
    expect(portalFromHost('driver.aa-rentacar.com')).toBe('driver');
    expect(portalFromHost('admin.aa-rentacar.com')).toBe('superadmin');
  });
});

describe('PORTAL_TO_SEGMENT', () => {
  it('maps superadmin to /admin and keeps public/customer at root', () => {
    expect(PORTAL_TO_SEGMENT.public).toBe('');
    expect(PORTAL_TO_SEGMENT.customer).toBe('');
    expect(PORTAL_TO_SEGMENT.manager).toBe('manager');
    expect(PORTAL_TO_SEGMENT.driver).toBe('driver');
    expect(PORTAL_TO_SEGMENT.superadmin).toBe('admin');
  });
});
