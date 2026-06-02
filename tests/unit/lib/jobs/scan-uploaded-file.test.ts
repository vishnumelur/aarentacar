import { describe, it, expect, vi } from 'vitest';
import { runScanUploadedFile } from '@/lib/jobs/handlers/scan-uploaded-file';

describe('runScanUploadedFile', () => {
  it('audits clean and does not quarantine when the scanner reports clean', async () => {
    const deps = {
      download: vi.fn().mockResolvedValue(Buffer.from('hello')),
      scan: vi.fn().mockResolvedValue({ clean: true }),
      rejectDocument: vi.fn().mockResolvedValue(undefined),
      audit: vi.fn().mockResolvedValue(undefined),
    };
    const result = await runScanUploadedFile(
      { bucket: 'documents', key: 'documents/u1/2026/06/abc.pdf', documentId: 'doc1' },
      deps,
    );
    expect(result).toEqual({ clean: true, quarantined: false });
    expect(deps.download).toHaveBeenCalledWith('documents', 'documents/u1/2026/06/abc.pdf');
    expect(deps.rejectDocument).not.toHaveBeenCalled();
    expect(deps.audit).toHaveBeenCalledWith(
      'job.scan_uploaded_file.clean',
      expect.objectContaining({ documentId: 'doc1' }),
    );
  });

  it('rejects the document with malware_detected when infected', async () => {
    const deps = {
      download: vi.fn().mockResolvedValue(Buffer.from('X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR')),
      scan: vi.fn().mockResolvedValue({ clean: false, signature: 'Eicar-Test-Signature' }),
      rejectDocument: vi.fn().mockResolvedValue(undefined),
      audit: vi.fn().mockResolvedValue(undefined),
    };
    const result = await runScanUploadedFile(
      { bucket: 'documents', key: 'documents/u1/2026/06/bad.pdf', documentId: 'doc2' },
      deps,
    );
    expect(result).toEqual({
      clean: false,
      signature: 'Eicar-Test-Signature',
      quarantined: true,
    });
    expect(deps.rejectDocument).toHaveBeenCalledWith('doc2', 'malware_detected');
    expect(deps.audit).toHaveBeenCalledWith(
      'job.scan_uploaded_file.infected',
      expect.objectContaining({ signature: 'Eicar-Test-Signature', quarantined: true }),
    );
  });

  it('audits infected without quarantine when there is no documentId (e.g. vehicle photo)', async () => {
    const deps = {
      download: vi.fn().mockResolvedValue(Buffer.from('payload')),
      scan: vi.fn().mockResolvedValue({ clean: false, signature: 'Win.Test' }),
      rejectDocument: vi.fn().mockResolvedValue(undefined),
      audit: vi.fn().mockResolvedValue(undefined),
    };
    const result = await runScanUploadedFile(
      { bucket: 'vehicles', key: 'vehicles/v1/2026/06/x.jpg' },
      deps,
    );
    expect(result.clean).toBe(false);
    expect(result.quarantined).toBe(false);
    expect(deps.rejectDocument).not.toHaveBeenCalled();
    expect(deps.audit).toHaveBeenCalledWith(
      'job.scan_uploaded_file.infected',
      expect.objectContaining({ quarantined: false }),
    );
  });
});
