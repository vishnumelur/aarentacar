import { describe, it, expect } from 'vitest';
import {
  generateTotpSecret,
  base32Encode,
  base32Decode,
  generateTotp,
  verifyTotp,
  buildOtpauthUri,
  generateRecoveryCodes,
} from '@/lib/totp/totp';

describe('base32', () => {
  it('round-trips arbitrary bytes', () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 251, 252, 253, 254, 255]);
    const enc = base32Encode(bytes);
    expect(enc).toMatch(/^[A-Z2-7]+$/);
    expect(Array.from(base32Decode(enc))).toEqual(Array.from(bytes));
  });

  it('decodes a known RFC 4648 vector', () => {
    // "Hello!" -> JBSWY3DPEHPK3PXP is "Hello!\xde\xad..." not standard; use simple vector
    // RFC 4648: 'foobar' base32 = MZXW6YTBOI======
    const decoded = base32Decode('MZXW6YTBOI');
    expect(Buffer.from(decoded).toString('utf8')).toBe('foobar');
  });
});

describe('generateTotp (RFC 6238)', () => {
  // RFC 6238 Appendix B test vectors use the SHA-1 ASCII seed "12345678901234567890"
  // ("3132...3930" hex). These are the canonical 8-digit TOTP values; we take the
  // last 6 digits for our 6-digit codes.
  const SEED = Buffer.from('12345678901234567890', 'utf8');
  const SECRET_B32 = base32Encode(new Uint8Array(SEED));

  const cases: Array<[number, string]> = [
    [59, '287082'],
    [1111111109, '081804'],
    [1111111111, '050471'],
    [1234567890, '005924'],
    [2000000000, '279037'],
    [20000000000, '353130'],
  ];

  for (const [unixSeconds, expected] of cases) {
    it(`matches the RFC vector at t=${unixSeconds}`, () => {
      const code = generateTotp(SECRET_B32, { now: new Date(unixSeconds * 1000) });
      expect(code).toBe(expected);
    });
  }
});

describe('verifyTotp', () => {
  const SECRET_B32 = base32Encode(new Uint8Array(Buffer.from('12345678901234567890', 'utf8')));

  it('accepts the correct current code', () => {
    const now = new Date(59 * 1000);
    expect(verifyTotp(SECRET_B32, '287082', { now })).toBe(true);
  });

  it('rejects a wrong code', () => {
    const now = new Date(59 * 1000);
    expect(verifyTotp(SECRET_B32, '000000', { now })).toBe(false);
  });

  it('accepts a code from the previous window (clock skew tolerance)', () => {
    // code valid at t=59 should still verify one step (30s) later at t=89
    const now = new Date(89 * 1000);
    expect(verifyTotp(SECRET_B32, '287082', { now, window: 1 })).toBe(true);
  });

  it('rejects a code two windows old when window=1', () => {
    const now = new Date(120 * 1000);
    expect(verifyTotp(SECRET_B32, '287082', { now, window: 1 })).toBe(false);
  });

  it('rejects malformed input', () => {
    const now = new Date(59 * 1000);
    expect(verifyTotp(SECRET_B32, 'abcdef', { now })).toBe(false);
    expect(verifyTotp(SECRET_B32, '12345', { now })).toBe(false);
  });
});

describe('generateTotpSecret', () => {
  it('produces a base32 secret of the expected length', () => {
    const s = generateTotpSecret();
    expect(s).toMatch(/^[A-Z2-7]+$/);
    // 20 bytes -> 32 base32 chars
    expect(s.length).toBe(32);
    // round-trips into a usable code
    const code = generateTotp(s, { now: new Date() });
    expect(code).toMatch(/^\d{6}$/);
  });

  it('is random across calls', () => {
    expect(generateTotpSecret()).not.toBe(generateTotpSecret());
  });
});

describe('buildOtpauthUri', () => {
  it('builds a valid otpauth URI', () => {
    const uri = buildOtpauthUri({
      secret: 'JBSWY3DPEHPK3PXP',
      accountName: 'admin@aa-rentacar.com',
      issuer: 'AA Rent A Car',
    });
    expect(uri).toContain('otpauth://totp/');
    expect(uri).toContain('secret=JBSWY3DPEHPK3PXP');
    expect(uri).toContain('issuer=AA%20Rent%20A%20Car');
    expect(uri).toContain('AA%20Rent%20A%20Car:admin%40aa-rentacar.com');
  });
});

describe('generateRecoveryCodes', () => {
  it('generates 10 unique formatted codes', () => {
    const codes = generateRecoveryCodes();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    for (const c of codes) {
      expect(c).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    }
  });
});
