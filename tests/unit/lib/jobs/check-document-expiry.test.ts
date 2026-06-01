import { describe, it, expect } from 'vitest';
import { computeExpiredDocs, type DocSummary } from '@/lib/jobs/check-document-expiry';

describe('computeExpiredDocs', () => {
  const today = new Date('2026-06-01');

  it('flags only approved docs whose expiry < today', () => {
    const docs: DocSummary[] = [
      { id: 'a', status: 'approved', expiryDate: '2025-12-31' },
      { id: 'b', status: 'approved', expiryDate: '2027-12-31' },
      { id: 'c', status: 'approved', expiryDate: null },
      { id: 'd', status: 'pending', expiryDate: '2024-01-01' },
      { id: 'e', status: 'expired', expiryDate: '2024-01-01' },
      { id: 'f', status: 'rejected', expiryDate: '2024-01-01' },
      { id: 'g', status: 'withdrawn', expiryDate: '2024-01-01' },
    ];
    expect(computeExpiredDocs(docs, today)).toEqual(['a']);
  });

  it('treats expiry equal to today as still valid (strict <)', () => {
    expect(
      computeExpiredDocs([{ id: 'x', status: 'approved', expiryDate: '2026-06-01' }], today),
    ).toEqual([]);
  });

  it('returns an empty list when nothing is approved', () => {
    expect(
      computeExpiredDocs(
        [
          { id: 'p', status: 'pending', expiryDate: '2020-01-01' },
          { id: 'r', status: 'rejected', expiryDate: '2020-01-01' },
        ],
        today,
      ),
    ).toEqual([]);
  });

  it('returns multiple IDs sorted by input order', () => {
    expect(
      computeExpiredDocs(
        [
          { id: 'late', status: 'approved', expiryDate: '2025-01-15' },
          { id: 'early', status: 'approved', expiryDate: '2024-06-01' },
          { id: 'still-valid', status: 'approved', expiryDate: '2030-01-01' },
        ],
        today,
      ),
    ).toEqual(['late', 'early']);
  });
});
