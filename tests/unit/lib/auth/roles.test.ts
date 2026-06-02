import { describe, it, expect } from 'vitest';
import {
  canAccessPortal,
  canAgent,
  portalFromHost,
  PORTAL_TO_SEGMENT,
  type AgentPermissionKey,
} from '@/lib/auth/roles';

const ALL_OFF = {
  canApproveBookings: false,
  canReviewKyc: false,
  canEditPricing: false,
  canManagePromos: false,
  canViewRevenue: false,
  canManageDrivers: false,
  canEditSettings: false,
};

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

describe('canAgent', () => {
  const keys: AgentPermissionKey[] = [
    'approve_bookings',
    'review_kyc',
    'edit_pricing',
    'manage_promos',
    'view_revenue',
    'manage_drivers',
    'edit_settings',
  ];

  it('managers and superadmins always pass, regardless of perms row', () => {
    for (const key of keys) {
      expect(canAgent('manager', key, null)).toBe(true);
      expect(canAgent('superadmin', key, null)).toBe(true);
      expect(canAgent('manager', key, ALL_OFF)).toBe(true);
    }
  });

  it('non-portal roles never pass', () => {
    expect(canAgent('customer', 'review_kyc', null)).toBe(false);
    expect(canAgent('driver', 'manage_drivers', null)).toBe(false);
  });

  it('agent passes only when the matching flag is set', () => {
    expect(canAgent('agent', 'review_kyc', null)).toBe(false);
    expect(canAgent('agent', 'review_kyc', ALL_OFF)).toBe(false);
    expect(canAgent('agent', 'review_kyc', { ...ALL_OFF, canReviewKyc: true })).toBe(true);
    // a different flag set does not grant review_kyc
    expect(canAgent('agent', 'review_kyc', { ...ALL_OFF, canEditPricing: true })).toBe(false);
    expect(canAgent('agent', 'edit_pricing', { ...ALL_OFF, canEditPricing: true })).toBe(true);
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
