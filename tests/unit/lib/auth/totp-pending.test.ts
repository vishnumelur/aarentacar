import { describe, it, expect } from 'vitest';
import {
  signTotpPending,
  verifyTotpPending,
} from '@/lib/auth/totp-pending';

const KEY = 'dGVzdGtleXRlc3RrZXl0ZXN0a2V5dGVzdGtleXRlc3Q=';

describe('totp-pending token', () => {
  it('round-trips a userId', () => {
    const token = signTotpPending('user-123', KEY, new Date(1_000_000));
    const result = verifyTotpPending(token, KEY, new Date(1_000_000 + 60_000));
    expect(result).toBe('user-123');
  });

  it('rejects a tampered payload', () => {
    const token = signTotpPending('user-123', KEY, new Date(1_000_000));
    const [encodedPayload, sig] = token.split('.') as [string, string];
    // Re-encode a different userId but keep the original signature.
    const forgedPayload = Buffer.from('user-999.1000000', 'utf8').toString('base64url');
    const tampered = `${forgedPayload}.${sig}`;
    expect(verifyTotpPending(tampered, KEY, new Date(1_000_000))).toBeNull();
    // sanity: the original still verifies
    expect(verifyTotpPending(`${encodedPayload}.${sig}`, KEY, new Date(1_000_000))).toBe(
      'user-123',
    );
  });

  it('rejects an expired token', () => {
    const token = signTotpPending('user-123', KEY, new Date(0));
    // 6 minutes later (TTL is 5 min)
    expect(verifyTotpPending(token, KEY, new Date(6 * 60_000))).toBeNull();
  });

  it('rejects garbage', () => {
    expect(verifyTotpPending('not-a-token', KEY, new Date())).toBeNull();
    expect(verifyTotpPending('a.b', KEY, new Date())).toBeNull();
  });

  it('rejects a token signed with a different key', () => {
    const token = signTotpPending('user-123', KEY, new Date(1_000_000));
    const otherKey = 'b3RoZXJrZXlvdGhlcmtleW90aGVya2V5b3RoZXJrZXk=';
    expect(verifyTotpPending(token, otherKey, new Date(1_000_000))).toBeNull();
  });
});
