'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { setDriverStatus } from '@/lib/actions/drivers';

type Status = 'available' | 'on_duty' | 'off_duty' | 'suspended';

const STATUS_LABELS: Record<Status, string> = {
  available: 'Available',
  on_duty: 'On duty',
  off_duty: 'Off duty',
  suspended: 'Suspended',
};

export function DriverStatusToggle({
  userId,
  currentStatus,
}: {
  userId: string;
  currentStatus: Status;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function onSet(status: Status) {
    setErr(null);
    const fd = new FormData();
    fd.set('userId', userId);
    fd.set('status', status);
    start(async () => {
      const res = await setDriverStatus(fd);
      if (!res.ok) setErr(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="text-sm font-medium">Status</div>
      <div className="flex flex-wrap gap-2">
        {(['available', 'on_duty', 'off_duty', 'suspended'] as const).map((s) => (
          <Button
            key={s}
            type="button"
            variant={currentStatus === s ? 'default' : 'outline'}
            size="sm"
            disabled={pending}
            onClick={() => onSet(s)}
          >
            {STATUS_LABELS[s]}
          </Button>
        ))}
      </div>
      {err && <p className="text-xs text-destructive">{err}</p>}
    </div>
  );
}
