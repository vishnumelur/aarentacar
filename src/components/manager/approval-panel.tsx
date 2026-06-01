'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { approveBooking, rejectBooking } from '@/lib/actions/dispatch';

interface Props {
  bookingId: string;
}

export function ApprovalPanel({ bookingId }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  function onApprove() {
    setError(null);
    const fd = new FormData();
    fd.set('id', bookingId);
    start(async () => {
      const res = await approveBooking(fd);
      if (res.ok) router.refresh();
      else setError(`Approve failed: ${res.error}`);
    });
  }

  function onReject(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set('id', bookingId);
    start(async () => {
      const res = await rejectBooking(fd);
      if (res.ok) {
        setShowReject(false);
        setReason('');
        router.refresh();
      } else {
        setError(`Reject failed: ${res.error}`);
      }
    });
  }

  return (
    <section className="rounded-lg border-2 border-primary bg-card p-6 space-y-4">
      <div>
        <h2 className="font-semibold">Action required</h2>
        <p className="text-sm text-muted-foreground">
          This booking is awaiting your approval before a driver can be dispatched.
        </p>
      </div>

      {!showReject ? (
        <div className="flex gap-2">
          <Button onClick={onApprove} disabled={pending}>
            {pending ? '…' : 'Approve booking'}
          </Button>
          <Button variant="ghost" onClick={() => setShowReject(true)} disabled={pending}>
            Reject
          </Button>
        </div>
      ) : (
        <form onSubmit={onReject} className="space-y-2">
          <label className="text-sm font-medium">Reason (visible to customer)</label>
          <textarea
            name="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            maxLength={500}
            required
            className="w-full rounded-md border px-3 py-2 text-sm"
            placeholder="e.g. Vehicle no longer available, customer ID failed re-verification, etc."
          />
          <div className="flex gap-2">
            <Button
              type="submit"
              variant="destructive"
              disabled={pending || reason.trim().length === 0}
              size="sm"
            >
              {pending ? '…' : 'Confirm reject'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowReject(false);
                setReason('');
              }}
              disabled={pending}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </section>
  );
}
