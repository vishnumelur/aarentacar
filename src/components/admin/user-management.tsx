'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  changeUserRole,
  suspendUser,
  reinstateUser,
  resetUserPassword,
} from '@/lib/actions/admin-users';

const ROLES = ['customer', 'driver', 'agent', 'manager', 'superadmin'] as const;

export function UserManagement({
  userId,
  role,
  status,
}: {
  userId: string;
  role: string;
  status: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [temp, setTemp] = useState<string | null>(null);

  function onRoleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value;
    startTransition(async () => {
      const fd = new FormData();
      fd.set('userId', userId);
      fd.set('role', next);
      const res = await changeUserRole(fd);
      if (res.ok) {
        toast.success('Role updated.');
        router.refresh();
      } else {
        toast.error('Could not change role.');
      }
    });
  }

  function toggleSuspend() {
    startTransition(async () => {
      const fd = new FormData();
      fd.set('userId', userId);
      const res = status === 'suspended' ? await reinstateUser(fd) : await suspendUser(fd);
      if (res.ok) {
        toast.success(status === 'suspended' ? 'User reinstated.' : 'User suspended.');
        router.refresh();
      } else {
        toast.error('Action failed.');
      }
    });
  }

  function reset() {
    startTransition(async () => {
      const fd = new FormData();
      fd.set('userId', userId);
      const res = await resetUserPassword(fd);
      if (res.ok) {
        setTemp(res.tempPassword);
        toast.success('Password reset. Share the temporary password securely.');
        router.refresh();
      } else {
        toast.error('Reset failed.');
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-sm">Role:</span>
        <select
          defaultValue={role}
          disabled={pending}
          onChange={onRoleChange}
          className="h-9 rounded-md border px-2 text-sm"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>
      <div className="flex gap-2">
        <Button
          variant={status === 'suspended' ? 'outline' : 'destructive'}
          disabled={pending}
          onClick={toggleSuspend}
        >
          {status === 'suspended' ? 'Reinstate' : 'Suspend'}
        </Button>
        <Button variant="outline" disabled={pending} onClick={reset}>
          Reset password
        </Button>
      </div>
      {temp && (
        <div className="bg-muted rounded p-3 text-sm">
          Temporary password (shown once):{' '}
          <code className="font-mono break-all">{temp}</code>
        </div>
      )}
    </div>
  );
}
