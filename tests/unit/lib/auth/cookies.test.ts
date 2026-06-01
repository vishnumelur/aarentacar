import { describe, it, expect } from 'vitest';
import {
  SESSION_COOKIE_NAME,
  buildSessionCookie,
  buildClearSessionCookie,
} from '@/lib/auth/cookies';

describe('cookies', () => {
  it('exposes a stable cookie name', () => {
    expect(SESSION_COOKIE_NAME).toBe('aa_session');
  });

  it('builds a cookie with secure defaults in production', () => {
    const cookie = buildSessionCookie({
      token: 'abc',
      expiresAt: new Date(2030, 0, 1),
      production: true,
      domain: 'aa-rentacar.com',
    });
    expect(cookie.name).toBe('aa_session');
    expect(cookie.value).toBe('abc');
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.secure).toBe(true);
    expect(cookie.sameSite).toBe('lax');
    expect(cookie.domain).toBe('aa-rentacar.com');
  });

  it('disables Secure flag in development', () => {
    const cookie = buildSessionCookie({
      token: 'abc',
      expiresAt: new Date(2030, 0, 1),
      production: false,
      domain: 'localhost',
    });
    expect(cookie.secure).toBe(false);
  });

  it('clear cookie has empty value and an expired date', () => {
    const cookie = buildClearSessionCookie({ production: true, domain: 'aa-rentacar.com' });
    expect(cookie.value).toBe('');
    expect(cookie.expires.getTime()).toBe(0);
  });
});
