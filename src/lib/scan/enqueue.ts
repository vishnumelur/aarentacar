import { enqueue, JOB_NAMES } from '@/lib/jobs/queue';
import type { ScanUploadedFileJob } from '@/lib/jobs/handlers/scan-uploaded-file';

/**
 * Enqueue API for the accept-then-scan virus scan (Plan #13, Task 7).
 *
 * Call sites enqueue a `scan-uploaded-file` job right after an upload completes
 * (e.g. `submitDocument`). The scan runs OUT of the request critical path in the
 * pg-boss worker. `enqueueScanSafe` swallows + logs so a worker/pg-boss outage
 * never fails the primary action — same pattern as `enqueueEmailSafe`.
 */

export async function enqueueScan(job: ScanUploadedFileJob): Promise<string | null> {
  return enqueue(JOB_NAMES.scanUploadedFile, job);
}

export async function enqueueScanSafe(job: ScanUploadedFileJob): Promise<void> {
  try {
    await enqueueScan(job);
  } catch (err) {
    console.warn('[scan] enqueue failed (non-fatal)', err);
  }
}
