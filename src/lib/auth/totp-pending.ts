import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Short-lived, HMAC-signed interim token (Plan #11). After a super-admin passes
 * the password check but still owes a TOTP code, we set this as a cookie
 * instead of finalizing the session. `/totp` verifies the code and only then
 * mints the real session. The token carries the userId + an issued-at; it is
 * signed under ENCRYPTION_KEY so it cannot be forged client-side.
 */

export const TOTP_PENDING_COOKIE_NAME = 'aa_totp_pending';
const TTL_MS = 5 * 60 * 1000; // 5 minutes to enter the code

function sign(payload: string, key: string): string {
  return createHmac('sha256', key).update(payload).digest('base64url');
}

export function signTotpPending(userId: string, key: string, now: Date = new Date()): string {
  const payload = `${userId}.${now.getTime()}`;
  const sig = sign(payload, key);
  return `${Buffer.from(payload).toString('base64url')}.${sig}`;
}

export function verifyTotpPending(
  token: string,
  key: string,
  now: Date = new Date(),
): string | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encodedPayload, sig] = parts as [string, string];
  let payload: string;
  try {
    payload = Buffer.from(encodedPayload, 'base64url').toString('utf8');
  } catch {
    return null;
  }
  const expected = sign(payload, key);
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }
  const dot = payload.lastIndexOf('.');
  if (dot === -1) return null;
  const userId = payload.slice(0, dot);
  const issuedAt = Number(payload.slice(dot + 1));
  if (!userId || !Number.isFinite(issuedAt)) return null;
  if (now.getTime() - issuedAt > TTL_MS) return null;
  return userId;
}
