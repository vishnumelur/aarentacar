import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * AES-256-GCM helpers for the provider-credential store (Plan #9).
 *
 * The master key is the base64-encoded `ENCRYPTION_KEY` from env (32 bytes).
 * Output blob layout: [ 12-byte IV | 16-byte auth tag | ciphertext ].
 *
 * GCM authenticates the ciphertext, so any tampering with the IV, tag, or
 * ciphertext — or decrypting with the wrong key — makes `decipher.final()`
 * throw, which is exactly the integrity guarantee we want for secrets.
 */

const IV_BYTES = 12;
const TAG_BYTES = 16;

function keyBuffer(masterKeyBase64: string): Buffer {
  const key = Buffer.from(masterKeyBase64, 'base64');
  if (key.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be 32 bytes (base64-encoded)');
  }
  return key;
}

export function encrypt(plaintext: string, masterKeyBase64: string): Buffer {
  const key = keyBuffer(masterKeyBase64);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]);
}

export function decrypt(blob: Buffer, masterKeyBase64: string): string {
  const key = keyBuffer(masterKeyBase64);
  const iv = blob.subarray(0, IV_BYTES);
  const tag = blob.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const enc = blob.subarray(IV_BYTES + TAG_BYTES);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}
