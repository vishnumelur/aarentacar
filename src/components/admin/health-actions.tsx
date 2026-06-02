'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  triggerManualBackup,
  triggerPingPrune,
  clearCredentialsCache,
} from '@/lib/actions/admin-ops';

type Action = () => Promise<{ ok: boolean; message?: string; error?: string }>;

export function HealthActions() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run(action: Action) {
    startTransition(async () => {
      const res = await action();
      if (res.ok) {
        toast.success(res.message ?? 'Done.');
        router.refresh();
      } else {
        toast.error(res.error ?? 'Failed.');
      }
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button disabled={pending} onClick={() => run(triggerManualBackup)}>
        Trigger DB backup
      </Button>
      <Button variant="outline" disabled={pending} onClick={() => run(triggerPingPrune)}>
        Prune driver pings
      </Button>
      <Button variant="outline" disabled={pending} onClick={() => run(clearCredentialsCache)}>
        Clear credentials cache
      </Button>
    </div>
  );
}
