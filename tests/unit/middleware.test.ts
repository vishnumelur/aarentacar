import { describe, it, expect } from 'vitest';
import { resolvePortalFromRequest } from '@/lib/auth/resolve-portal';

function reqFor(host: string): Request {
  return new Request(`https://${host}/`, { headers: { host } });
}

describe('resolvePortalFromRequest', () => {
  it('returns public for the apex / www host', () => {
    expect(resolvePortalFromRequest(reqFor('aa-rentacar.com'))).toBe('public');
    expect(resolvePortalFromRequest(reqFor('www.aa-rentacar.com'))).toBe('public');
  });

  it('returns manager / driver / superadmin for the matching subdomain', () => {
    expect(resolvePortalFromRequest(reqFor('manager.aa-rentacar.com'))).toBe('manager');
    expect(resolvePortalFromRequest(reqFor('driver.aa-rentacar.com'))).toBe('driver');
    expect(resolvePortalFromRequest(reqFor('admin.aa-rentacar.com'))).toBe('superadmin');
  });

  it('returns public for localhost in dev', () => {
    expect(resolvePortalFromRequest(reqFor('localhost:3000'))).toBe('public');
  });

  it('lets dev pretend to be a portal via ?portal= query', () => {
    const r = new Request('https://localhost:3000/?portal=manager');
    expect(resolvePortalFromRequest(r)).toBe('manager');
  });

  it('ignores invalid ?portal= values', () => {
    const r = new Request('https://localhost:3000/?portal=fake');
    expect(resolvePortalFromRequest(r)).toBe('public');
  });
});
