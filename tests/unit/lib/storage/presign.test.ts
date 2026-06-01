import { describe, it, expect } from 'vitest';
import {
  buildVehiclePhotoKey,
  isAllowedPhotoContentType,
  buildCustomerDocumentKey,
  isAllowedDocumentContentType,
} from '@/lib/storage/presign';

describe('buildVehiclePhotoKey', () => {
  it('includes the vehicle id, yyyy/mm prefix, and 12-char nonce', () => {
    const key = buildVehiclePhotoKey({ vehicleId: 'abc-123', mimeType: 'image/jpeg' });
    expect(key).toMatch(/^vehicles\/abc-123\/\d{4}\/\d{2}\/[a-f0-9]{12}\.jpg$/);
  });

  it('maps mime types to extensions', () => {
    expect(buildVehiclePhotoKey({ vehicleId: 'x', mimeType: 'image/png' })).toMatch(/\.png$/);
    expect(buildVehiclePhotoKey({ vehicleId: 'x', mimeType: 'image/webp' })).toMatch(/\.webp$/);
    expect(buildVehiclePhotoKey({ vehicleId: 'x', mimeType: 'image/avif' })).toMatch(/\.avif$/);
  });
});

describe('isAllowedPhotoContentType', () => {
  it.each(['image/jpeg', 'image/png', 'image/webp', 'image/avif'])('allows %s', (m) => {
    expect(isAllowedPhotoContentType(m)).toBe(true);
  });

  it.each(['image/gif', 'image/svg+xml', 'application/pdf', 'text/plain'])(
    'rejects %s',
    (m) => {
      expect(isAllowedPhotoContentType(m)).toBe(false);
    },
  );
});

describe('buildCustomerDocumentKey', () => {
  it('includes userId + yyyy/mm prefix + 12-char nonce', () => {
    const key = buildCustomerDocumentKey({ userId: 'user-1', mimeType: 'image/jpeg' });
    expect(key).toMatch(/^documents\/user-1\/\d{4}\/\d{2}\/[a-f0-9]{12}\.jpg$/);
  });
  it('supports PDF mime', () => {
    const key = buildCustomerDocumentKey({ userId: 'u', mimeType: 'application/pdf' });
    expect(key).toMatch(/\.pdf$/);
  });
});

describe('isAllowedDocumentContentType', () => {
  it.each(['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])('allows %s', (m) => {
    expect(isAllowedDocumentContentType(m)).toBe(true);
  });
  it.each(['image/gif', 'application/zip', 'text/html'])('rejects %s', (m) => {
    expect(isAllowedDocumentContentType(m)).toBe(false);
  });
});
