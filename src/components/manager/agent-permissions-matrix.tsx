'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { saveAgentPermissions } from '@/lib/actions/agent-permissions';

export interface AgentRow {
  id: string;
  fullName: string;
  email: string;
  canApproveBookings: boolean;
  canReviewKyc: boolean;
  canEditPricing: boolean;
  canManagePromos: boolean;
  canViewRevenue: boolean;
  canManageDrivers: boolean;
  canEditSettings: boolean;
}

const PERMISSIONS: { field: string; label: string }[] = [
  { field: 'can_approve_bookings', label: 'Approve bookings' },
  { field: 'can_review_kyc', label: 'Review KYC' },
  { field: 'can_edit_pricing', label: 'Edit pricing' },
  { field: 'can_manage_promos', label: 'Manage promos' },
  { field: 'can_view_revenue', label: 'View revenue' },
  { field: 'can_manage_drivers', label: 'Manage drivers' },
  { field: 'can_edit_settings', label: 'Edit settings' },
];

const FIELD_TO_VALUE: Record<string, keyof AgentRow> = {
  can_approve_bookings: 'canApproveBookings',
  can_review_kyc: 'canReviewKyc',
  can_edit_pricing: 'canEditPricing',
  can_manage_promos: 'canManagePromos',
  can_view_revenue: 'canViewRevenue',
  can_manage_drivers: 'canManageDrivers',
  can_edit_settings: 'canEditSettings',
};

export function AgentPermissionsMatrix({ agent }: { agent: AgentRow }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res = await saveAgentPermissions(fd);
      if (res.ok) {
        toast.success('Permissions saved.');
        router.refresh();
      } else {
        toast.error(`Failed: ${res.error}`);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="rounded-lg border bg-card p-6">
      <input type="hidden" name="userId" value={agent.id} />
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium">{agent.fullName}</div>
          <div className="text-xs text-muted-foreground">{agent.email}</div>
        </div>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? 'Saving…' : 'Save'}
        </Button>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {PERMISSIONS.map((p) => (
          <label key={p.field} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name={p.field}
              defaultChecked={Boolean(agent[FIELD_TO_VALUE[p.field]!])}
              className="size-4"
            />
            {p.label}
          </label>
        ))}
      </div>
    </form>
  );
}
