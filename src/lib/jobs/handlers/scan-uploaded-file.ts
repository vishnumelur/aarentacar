import type { Scanner } from '@/lib/scan/clamav';

/**
 * Pure orchestration for the `scan-uploaded-file` pg-boss job (Plan #13, Task 7).
 *
 * Accept-then-scan model: an upload completes (customer document, vehicle photo,
 * inspection photo, …) and the upload path enqueues this job with the bucket +
 * object key. The worker downloads the object from MinIO, streams it to clamd,
 * and on an infected result quarantines the artifact — for customer documents
 * that means flipping the row to `rejected` with review_note='malware_detected'.
 *
 * All IO (MinIO download, clamd TCP, DB update) is injected so the decision
 * logic is unit-testable with a fake scanner and in-memory stubs — no real
 * clamd or MinIO in CI.
 */

export interface ScanUploadedFileJob {
  /** MinIO bucket the object lives in (e.g. `documents`, `vehicles`). */
  bucket: string;
  /** Object key within the bucket. */
  key: string;
  /**
   * Optional row to quarantine when infected. `documentId` flips a
   * customer_documents row to rejected. Other kinds are scanned + audited but
   * have no dedicated quarantine column, so they are logged only.
   */
  documentId?: string;
}

type AuditFn = (action: string, payload: Record<string, unknown>) => Promise<void>;

export interface ScanUploadedFileDeps {
  /** Download the object bytes from object storage. */
  download: (bucket: string, key: string) => Promise<Buffer>;
  /** Scan the bytes; resolves clean/infected. */
  scan: Scanner;
  /** Mark a customer document rejected for malware. Only called when infected. */
  rejectDocument: (documentId: string, note: string) => Promise<void>;
  audit: AuditFn;
}

export interface ScanUploadedFileResult {
  clean: boolean;
  signature?: string;
  quarantined: boolean;
}

const MALWARE_NOTE = 'malware_detected';

export async function runScanUploadedFile(
  job: ScanUploadedFileJob,
  deps: ScanUploadedFileDeps,
): Promise<ScanUploadedFileResult> {
  const buf = await deps.download(job.bucket, job.key);
  const result = await deps.scan(buf);

  if (result.clean) {
    await deps.audit('job.scan_uploaded_file.clean', {
      bucket: job.bucket,
      key: job.key,
      documentId: job.documentId ?? null,
    });
    return { clean: true, quarantined: false };
  }

  // Infected: quarantine where we can.
  let quarantined = false;
  if (job.documentId) {
    await deps.rejectDocument(job.documentId, MALWARE_NOTE);
    quarantined = true;
  }

  await deps.audit('job.scan_uploaded_file.infected', {
    bucket: job.bucket,
    key: job.key,
    documentId: job.documentId ?? null,
    signature: result.signature ?? 'unknown',
    quarantined,
  });

  return { clean: false, signature: result.signature, quarantined };
}
