/**
 * Pure function: given a list of document summaries and "today",
 * return the IDs of docs that should be flipped to `expired`.
 *
 * A document is considered expired when:
 *   - its current status is `approved` (we don't re-expire already-expired
 *     ones, and we don't touch pending/rejected/withdrawn rows)
 *   - it has a tracked expiryDate
 *   - that expiryDate is strictly before today
 *
 * The real runner script in Plan #11 wires this to pg-boss + the DB UPDATE.
 */

export interface DocSummary {
  id: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired' | 'withdrawn';
  expiryDate: string | null;
}

export function computeExpiredDocs(docs: DocSummary[], today: Date): string[] {
  const todayStr = today.toISOString().slice(0, 10);
  return docs
    .filter((d) => d.status === 'approved' && d.expiryDate !== null && d.expiryDate < todayStr)
    .map((d) => d.id);
}
