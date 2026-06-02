import { describe, it, expect } from 'vitest';
import { randomBytes } from 'node:crypto';
import { encrypt, decrypt } from '@/lib/crypto/aes-gcm';

// A valid 32-byte (base64) master key and a different one for the wrong-key case.
const KEY = randomBytes(32).toString('base64');
const OTHER_KEY = randomBytes(32).toString('base64');

describe('aes-gcm', () => {
  it('round-trips plaintext through encrypt → decrypt', () => {
    const plaintext = 'sk_live_supersecret_value_1234';
    const blob = encrypt(plaintext, KEY);
    expect(Buffer.isBuffer(blob)).toBe(true);
    // 12-byte IV + 16-byte tag + ciphertext
    expect(blob.length).toBeGreaterThan(28);
    expect(decrypt(blob, KEY)).toBe(plaintext);
  });

  it('produces a fresh IV per call (ciphertext is non-deterministic)', () => {
    const a = encrypt('same', KEY);
    const b = encrypt('same', KEY);
    expect(a.equals(b)).toBe(false);
    expect(decrypt(a, KEY)).toBe('same');
    expect(decrypt(b, KEY)).toBe('same');
  });

  it('throws when the master key is not 32 bytes', () => {
    const shortKey = randomBytes(16).toString('base64');
    expect(() => encrypt('x', shortKey)).toThrow(/32 bytes/);
  });

  it('throws on tampered ciphertext', () => {
    const blob = encrypt('secret', KEY);
    const tampered = Buffer.from(blob);
    // flip a byte in the ciphertext region (after iv+tag)
    tampered.writeUInt8(tampered.readUInt8(29) ^ 0xff, 29);
    expect(() => decrypt(tampered, KEY)).toThrow();
  });

  it('throws on a tampered auth tag', () => {
    const blob = encrypt('secret', KEY);
    const tampered = Buffer.from(blob);
    // flip a byte inside the tag region (bytes 12..28)
    tampered.writeUInt8(tampered.readUInt8(14) ^ 0xff, 14);
    expect(() => decrypt(tampered, KEY)).toThrow();
  });

  it('throws when decrypting with the wrong key', () => {
    const blob = encrypt('secret', KEY);
    expect(() => decrypt(blob, OTHER_KEY)).toThrow();
  });
});
