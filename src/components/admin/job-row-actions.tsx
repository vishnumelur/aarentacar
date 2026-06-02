'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { retryJobAction, cancelJobAction } from '@/lib/actions/jobs';

export function JobRowActions({
  name,
  id,
  state,
}: {
  name: string;
  id: string;
  state: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function act(fn: typeof retryJobAction, label: string) {
    startTransition(async () => {
      const fd = new FormData();
      fd.set('name', name);
      fd.set('id', id);
      const res = await fn(fd);
      if (res.ok) {
        toast.success(`Job ${label}.`);
        router.refresh();
      } else {
        toast.error(`Could not ${label} job.`);
      }
    });
  }

  const canRetry = state === 'failed' || state === 'cancelled';
  const canCancel = state === 'created' || state === 'retry' || state === 'active';

  return (
    <div className="flex gap-2">
      {canRetry && (
        <Button size="sm" variant="outline" disabled={pending} onClick={() => act(retryJobAction, 'retried')}>
          Retry
        </Button>
      )}
      {canCancel && (
        <Button size="sm" variant="outline" disabled={pending} onClick={() => act(cancelJobAction, 'cancelled')}>
          Cancel
        </Button>
      )}
    </div>
  );
}
