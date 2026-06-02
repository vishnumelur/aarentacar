import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { AdminPage } from '@/components/admin/admin-page';
import { DangerZone } from '@/components/admin/danger-zone';
import { DROPPABLE_TABLES } from '@/lib/actions/danger-tables';

export const dynamic = 'force-dynamic';

export default async function DangerPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'superadmin') redirect('/login');

  return (
    <AdminPage title="Danger Zone">
      <p className="text-muted-foreground mb-6 max-w-2xl text-sm">
        Destructive operations. Every action is audit-logged and requires a typed
        confirmation. Core tables (users, bookings, audit logs) cannot be dropped.
      </p>
      <div className="max-w-xl">
        <DangerZone tables={DROPPABLE_TABLES} />
      </div>
    </AdminPage>
  );
}
