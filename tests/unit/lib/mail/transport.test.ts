import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Transport tests (Plan #12). nodemailer.createTransport is mocked so NO real
 * SMTP socket is opened. The credential store is mocked to assert the
 * store-first / env-fallback resolution and the managed-relay (auth) switch.
 */

const createTransport = vi.fn().mockReturnValue({ sendMail: vi.fn() });
vi.mock('nodemailer', () => ({
  default: { createTransport },
}));

const getCredential = vi.fn();
vi.mock('@/lib/credentials/store', () => ({ getCredential }));

async function importTransport() {
  return await import('@/lib/mail/transport');
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getTransport', () => {
  it('defaults to the internal postfix:25 relay with no auth when no credentials set', async () => {
    getCredential.mockResolvedValue(null);
    const { getTransport } = await importTransport();
    const { from } = await getTransport();

    expect(createTransport).toHaveBeenCalledTimes(1);
    const cfg = createTransport.mock.calls[0]![0];
    expect(cfg).toMatchObject({ host: 'postfix', port: 25, secure: false });
    expect(cfg.auth).toBeUndefined();
    expect(from).toBe('AA Rent A Car <no-reply@aa-rentacar.com>');
  });

  it('uses stored credentials and enables auth + STARTTLS for a managed relay', async () => {
    const values: Record<string, string> = {
      host: 'smtp.mailgun.org',
      port: '587',
      from: 'hello@aa-rentacar.com',
      from_name: 'AA Cars',
      user: 'postmaster@mg.aa-rentacar.com',
      password: 'secret',
    };
    getCredential.mockImplementation(async (_provider: string, key: string) => values[key] ?? null);

    const { getTransport } = await importTransport();
    const { from } = await getTransport();

    const cfg = createTransport.mock.calls[0]![0];
    expect(cfg).toMatchObject({
      host: 'smtp.mailgun.org',
      port: 587,
      secure: false,
      requireTLS: true,
    });
    expect(cfg.auth).toEqual({ user: 'postmaster@mg.aa-rentacar.com', pass: 'secret' });
    expect(from).toBe('AA Cars <hello@aa-rentacar.com>');
  });

  it('uses implicit TLS (secure) for port 465', async () => {
    getCredential.mockImplementation(async (_p: string, key: string) =>
      key === 'port' ? '465' : key === 'user' ? 'u' : key === 'password' ? 'p' : null,
    );
    const { getTransport } = await importTransport();
    await getTransport();
    const cfg = createTransport.mock.calls[0]![0];
    expect(cfg.secure).toBe(true);
    expect(cfg.requireTLS).toBe(false);
  });
});
