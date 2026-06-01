import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('parseEnv', () => {
  beforeEach(() => vi.resetModules());

  const validBase = {
    DATABASE_URL: 'postgres://u:p@localhost:5432/aa',
    ENCRYPTION_KEY: 'a'.repeat(44),
    SESSION_COOKIE_DOMAIN: 'localhost',
    NODE_ENV: 'test',
  };

  it('parses valid env', async () => {
    const { parseEnv } = await import('@/lib/env');
    const parsed = parseEnv(validBase);
    expect(parsed.DATABASE_URL).toBe('postgres://u:p@localhost:5432/aa');
    expect(parsed.NODE_ENV).toBe('test');
    expect(parsed.SMTP_HOST).toBe('localhost');
    expect(parsed.SMTP_PORT).toBe(25);
  });

  it('throws on missing required vars', async () => {
    const { parseEnv } = await import('@/lib/env');
    expect(() => parseEnv({})).toThrow(/DATABASE_URL/);
  });

  it('throws on short ENCRYPTION_KEY', async () => {
    const { parseEnv } = await import('@/lib/env');
    expect(() =>
      parseEnv({
        ...validBase,
        ENCRYPTION_KEY: 'too-short',
      }),
    ).toThrow(/ENCRYPTION_KEY/);
  });

  it('coerces SMTP_PORT to number', async () => {
    const { parseEnv } = await import('@/lib/env');
    const parsed = parseEnv({ ...validBase, SMTP_PORT: '587' });
    expect(parsed.SMTP_PORT).toBe(587);
    expect(typeof parsed.SMTP_PORT).toBe('number');
  });
});
