import { redirect, notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { AdminPage } from '@/components/admin/admin-page';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { UserManagement } from '@/components/admin/user-management';

export const dynamic = 'force-dynamic';

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== 'superadmin') redirect('/login');

  const { id } = await params;
  const [u] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!u) notFound();

  return (
    <AdminPage title={u.fullName}>
      <div className="grid max-w-2xl gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Details</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground space-y-1 text-sm">
            <div>Email: {u.email}</div>
            <div>Phone: {u.phone ?? '—'}</div>
            <div>Verification: {u.verificationStatus}</div>
            <div>Created: {u.createdAt.toISOString().slice(0, 10)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Management</CardTitle>
          </CardHeader>
          <CardContent>
            <UserManagement userId={u.id} role={u.role} status={u.status} />
          </CardContent>
        </Card>
      </div>
    </AdminPage>
  );
}
