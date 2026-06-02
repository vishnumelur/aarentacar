import { describe, it, expect, vi } from 'vitest';
import {
  testStripeConnection,
  testTabbyConnection,
  testMapboxConnection,
} from '@/lib/credentials/test-connection';

describe('test-connection helpers', () => {
  describe('stripe', () => {
    it('succeeds when balance.retrieve resolves', async () => {
      const stripeFactory = () =>
        ({ balance: { retrieve: vi.fn(async () => ({ object: 'balance' })) } }) as never;
      const res = await testStripeConnection('sk_test_x', stripeFactory);
      expect(res.ok).toBe(true);
    });

    it('fails with a helpful message when Stripe throws', async () => {
      const stripeFactory = () =>
        ({
          balance: {
            retrieve: vi.fn(async () => {
              throw new Error('Invalid API Key provided');
            }),
          },
        }) as never;
      const res = await testStripeConnection('sk_bad', stripeFactory);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error).toMatch(/Invalid API Key/);
    });

    it('fails when no key is set', async () => {
      const res = await testStripeConnection('', () => ({}) as never);
      expect(res.ok).toBe(false);
    });
  });

  describe('tabby', () => {
    it('succeeds on a 200 from /me', async () => {
      const fetchImpl = vi.fn(async () => ({ ok: true, status: 200 }) as Response);
      const res = await testTabbyConnection('sk_tabby', fetchImpl);
      expect(res.ok).toBe(true);
    });

    it('fails on a 401', async () => {
      const fetchImpl = vi.fn(
        async () => ({ ok: false, status: 401, text: async () => 'unauthorized' }) as Response,
      );
      const res = await testTabbyConnection('sk_bad', fetchImpl);
      expect(res.ok).toBe(false);
    });

    it('fails when no key is set', async () => {
      const res = await testTabbyConnection('', vi.fn());
      expect(res.ok).toBe(false);
    });
  });

  describe('mapbox', () => {
    it('succeeds on a 200 geocode', async () => {
      const fetchImpl = vi.fn(async () => ({ ok: true, status: 200 }) as Response);
      const res = await testMapboxConnection('pk.token', fetchImpl);
      expect(res.ok).toBe(true);
    });

    it('fails on a 401', async () => {
      const fetchImpl = vi.fn(
        async () => ({ ok: false, status: 401, text: async () => 'Not Authorized' }) as Response,
      );
      const res = await testMapboxConnection('pk.bad', fetchImpl);
      expect(res.ok).toBe(false);
    });

    it('fails when no token is set', async () => {
      const res = await testMapboxConnection('', vi.fn());
      expect(res.ok).toBe(false);
    });
  });
});
