import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { verifyTabbySignature } from '@/lib/payments/tabby';

const secret = 'whsec_tabby_test';
const body = JSON.stringify({ id: 'pay_123', status: 'AUTHORIZED' });

function sign(b: string, s: string): string {
  return createHmac('sha256', s).update(b).digest('hex');
}

describe('verifyTabbySignature', () => {
  it('accepts a correct signature', () => {
    expect(verifyTabbySignature(body, sign(body, secret), secret)).toBe(true);
  });

  it('rejects a tampered body', () => {
    const sig = sign(body, secret);
    expect(verifyTabbySignature(body + 'x', sig, secret)).toBe(false);
  });

  it('rejects a wrong secret', () => {
    expect(verifyTabbySignature(body, sign(body, 'other'), secret)).toBe(false);
  });

  it('rejects an empty / malformed signature without throwing', () => {
    expect(verifyTabbySignature(body, '', secret)).toBe(false);
  });
});
