import { describe, it, expect, vi } from 'vitest';
import {
  runDocumentExpiry,
  runDepositRelease,
  runDriverPingsPrune,
} from '@/lib/jobs/handlers';

describe('runDocumentExpiry', () => {
  it('flips approved docs whose expiry is in the past and audits the run', async () => {
    const today = new Date('2026-06-02T02:00:00Z');
    const deps = {
      loadDocs: vi.fn().mockResolvedValue([
        { id: 'a', status: 'approved', expiryDate: '2026-06-01' }, // expired
        { id: 'b', status: 'approved', expiryDate: '2026-06-10' }, // fine
        { id: 'c', status: 'pending', expiryDate: '2020-01-01' }, // not approved
      ]),
      markExpired: vi.fn().mockResolvedValue(undefined),
      audit: vi.fn().mockResolvedValue(undefined),
      now: today,
    };
    const result = await runDocumentExpiry(deps);
    expect(result.expiredCount).toBe(1);
    expect(deps.markExpired).toHaveBeenCalledWith(['a']);
    expect(deps.audit).toHaveBeenCalledWith('job.document_expiry.completed', { expiredCount: 1 });
  });

  it('does not call markExpired when nothing is due', async () => {
    const deps = {
      loadDocs: vi.fn().mockResolvedValue([
        { id: 'b', status: 'approved', expiryDate: '2099-01-01' },
      ]),
      markExpired: vi.fn().mockResolvedValue(undefined),
      audit: vi.fn().mockResolvedValue(undefined),
      now: new Date('2026-06-02T00:00:00Z'),
    };
    const result = await runDocumentExpiry(deps);
    expect(result.expiredCount).toBe(0);
    expect(deps.markExpired).not.toHaveBeenCalled();
  });
});

describe('runDepositRelease', () => {
  it('releases only the eligible held deposits', async () => {
    const now = new Date('2026-06-02T12:00:00Z');
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const tenMinAgo = new Date(now.getTime() - 10 * 60 * 1000);
    const deps = {
      loadHeldDeposits: vi.fn().mockResolvedValue([
        { holdId: 'h1', status: 'held', returnCompletedAt: twoHoursAgo, damageEstimateAed: 0 }, // eligible
        { holdId: 'h2', status: 'held', returnCompletedAt: tenMinAgo, damageEstimateAed: 0 }, // too recent
        { holdId: 'h3', status: 'held', returnCompletedAt: twoHoursAgo, damageEstimateAed: 500 }, // damage
        { holdId: 'h4', status: 'held', returnCompletedAt: null, damageEstimateAed: 0 }, // not returned
      ]),
      releaseHold: vi.fn().mockResolvedValue(undefined),
      audit: vi.fn().mockResolvedValue(undefined),
      now,
    };
    const result = await runDepositRelease(deps);
    expect(result.releasedCount).toBe(1);
    expect(deps.releaseHold).toHaveBeenCalledTimes(1);
    expect(deps.releaseHold).toHaveBeenCalledWith('h1');
  });

  it('continues past a single failing release and reports it', async () => {
    const now = new Date('2026-06-02T12:00:00Z');
    const old = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const deps = {
      loadHeldDeposits: vi.fn().mockResolvedValue([
        { holdId: 'h1', status: 'held', returnCompletedAt: old, damageEstimateAed: 0 },
        { holdId: 'h2', status: 'held', returnCompletedAt: old, damageEstimateAed: 0 },
      ]),
      releaseHold: vi
        .fn()
        .mockRejectedValueOnce(new Error('stripe down'))
        .mockResolvedValueOnce(undefined),
      audit: vi.fn().mockResolvedValue(undefined),
      now,
    };
    const result = await runDepositRelease(deps);
    expect(result.releasedCount).toBe(1);
    expect(result.failedCount).toBe(1);
  });
});

describe('runDriverPingsPrune', () => {
  it('deletes pings older than the retention window and audits', async () => {
    const now = new Date('2026-06-02T03:00:00Z');
    const deps = {
      deleteOlderThan: vi.fn().mockResolvedValue(42),
      audit: vi.fn().mockResolvedValue(undefined),
      now,
      retentionMs: 24 * 60 * 60 * 1000,
    };
    const result = await runDriverPingsPrune(deps);
    expect(result.deletedCount).toBe(42);
    const cutoff = deps.deleteOlderThan.mock.calls[0]![0] as Date;
    expect(cutoff.getTime()).toBe(now.getTime() - 24 * 60 * 60 * 1000);
    expect(deps.audit).toHaveBeenCalledWith('job.driver_pings_prune.completed', { deletedCount: 42 });
  });
});
