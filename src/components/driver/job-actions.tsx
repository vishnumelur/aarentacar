'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { acceptJob, declineJob } from '@/lib/actions/driver-jobs';

interface Props {
  assignmentId: string;
}

export function JobActions({ assignmentId }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [showDecline, setShowDecline] = useState(false);
  const [reason, setReason] = useState('');
  const [err, setErr] = useState<string | null>(null);

  function onAccept() {
    setErr(null);
    start(async () => {
      const res = await acceptJob({ assignmentId });
      if (res.ok) router.refresh();
      else setErr(res.error);
    });
  }

  function onDecline(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    start(async () => {
      const res = await declineJob({ assignmentId, reason: reason.trim() });
      if (res.ok) router.push('/driver');
      else setErr(res.error);
    });
  }

  if (showDecline) {
    return (
      <form onSubmit={onDecline} className="space-y-3">
        <label className="text-sm font-medium">Reason (visible to manager)</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          maxLength={500}
          required
          className="w-full rounded-md border px-3 py-2 text-sm"
          placeholder="e.g. Already heading home, vehicle not available, etc."
        />
        <div className="flex gap-2">
          <Button
            type="submit"
            variant="destructive"
            disabled={pending || reason.trim().length === 0}
          >
            {pending ? '…' : 'Confirm decline'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setShowDecline(false);
              setReason('');
            }}
            disabled={pending}
          >
            Cancel
          </Button>
        </div>
        {err && <p className="text-sm text-destructive">{err}</p>}
      </form>
    );
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <Button size="lg" onClick={onAccept} disabled={pending}>
          {pending ? '…' : 'Accept job'}
        </Button>
        <Button size="lg" variant="ghost" onClick={() => setShowDecline(true)} disabled={pending}>
          Decline
        </Button>
      </div>
      {err && <p className="text-sm text-destructive">{err}</p>}
    </div>
  );
}
