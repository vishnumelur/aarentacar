import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Self-contained RFC 6238 (TOTP) + RFC 4226 (HOTP) implementation, plus the
 * RFC 4648 base32 codec authenticator apps expect. No third-party dependency —
 * the moving pieces (HMAC, time-step counter, dynamic truncation) are tiny and
 * fully unit-tested against the RFC 6238 Appendix B vectors.
 *
 * Used to give super-admin accounts mandatory 2FA at login (Plan #11).
 */

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const DEFAULT_STEP_SECONDS = 30;
const DEFAULT_DIGITS = 6;
const DEFAULT_SECRET_BYTES = 20; // 160-bit, the SHA-1 HMAC block-friendly default

export function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return out;
}

export function base32Decode(input: string): Uint8Array {
  const clean = input.toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of clean) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) throw new Error(`Invalid base32 character: ${char}`);
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Uint8Array.from(out);
}

/** Generate a fresh random TOTP secret as a base32 string. */
export function generateTotpSecret(bytes: number = DEFAULT_SECRET_BYTES): string {
  return base32Encode(new Uint8Array(randomBytes(bytes)));
}

function hotp(secret: Uint8Array, counter: number, digits: number): string {
  // 8-byte big-endian counter.
  const buf = Buffer.alloc(8);
  // counter can exceed 2^32, so split into high/low 32 bits.
  buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buf.writeUInt32BE(counter >>> 0, 4);

  const hmac = createHmac('sha1', Buffer.from(secret)).update(buf).digest();
  const offset = hmac[hmac.length - 1]! & 0x0f;
  const binary =
    ((hmac[offset]! & 0x7f) << 24) |
    ((hmac[offset + 1]! & 0xff) << 16) |
    ((hmac[offset + 2]! & 0xff) << 8) |
    (hmac[offset + 3]! & 0xff);
  const otp = binary % 10 ** digits;
  return otp.toString().padStart(digits, '0');
}

export interface TotpOptions {
  now?: Date;
  stepSeconds?: number;
  digits?: number;
}

export function generateTotp(secretBase32: string, opts: TotpOptions = {}): string {
  const step = opts.stepSeconds ?? DEFAULT_STEP_SECONDS;
  const digits = opts.digits ?? DEFAULT_DIGITS;
  const now = opts.now ?? new Date();
  const counter = Math.floor(now.getTime() / 1000 / step);
  return hotp(base32Decode(secretBase32), counter, digits);
}

export interface VerifyOptions extends TotpOptions {
  /** Number of steps of clock skew to tolerate on each side. Default 1. */
  window?: number;
}

export function verifyTotp(
  secretBase32: string,
  code: string,
  opts: VerifyOptions = {},
): boolean {
  const digits = opts.digits ?? DEFAULT_DIGITS;
  const candidate = code.trim();
  if (!new RegExp(`^\\d{${digits}}$`).test(candidate)) return false;

  const step = opts.stepSeconds ?? DEFAULT_STEP_SECONDS;
  const window = opts.window ?? 1;
  const now = opts.now ?? new Date();
  const baseCounter = Math.floor(now.getTime() / 1000 / step);
  const secret = base32Decode(secretBase32);

  for (let i = -window; i <= window; i++) {
    const expected = hotp(secret, baseCounter + i, digits);
    if (
      expected.length === candidate.length &&
      timingSafeEqual(Buffer.from(expected), Buffer.from(candidate))
    ) {
      return true;
    }
  }
  return false;
}

export function buildOtpauthUri(input: {
  secret: string;
  accountName: string;
  issuer: string;
  digits?: number;
  stepSeconds?: number;
}): string {
  const digits = input.digits ?? DEFAULT_DIGITS;
  const period = input.stepSeconds ?? DEFAULT_STEP_SECONDS;
  const label = `${encodeURIComponent(input.issuer)}:${encodeURIComponent(input.accountName)}`;
  const params = new URLSearchParams({
    secret: input.secret,
    issuer: input.issuer,
    algorithm: 'SHA1',
    digits: String(digits),
    period: String(period),
  });
  // otpauth URIs use percent-encoding (%20) for spaces, not the form-style '+'.
  return `otpauth://totp/${label}?${params.toString().replace(/\+/g, '%20')}`;
}

/**
 * Generate human-friendly single-use recovery codes (XXXX-XXXX). We exclude the
 * ambiguous 0/O and 1/I characters so they're easy to read off paper.
 */
export function generateRecoveryCodes(count = 10): string[] {
  const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const codes = new Set<string>();
  while (codes.size < count) {
    const bytes = randomBytes(8);
    let chars = '';
    for (let i = 0; i < 8; i++) {
      chars += ALPHABET[bytes[i]! % ALPHABET.length];
    }
    codes.add(`${chars.slice(0, 4)}-${chars.slice(4, 8)}`);
  }
  return [...codes];
}
