import { asc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { users, agentPermissions } from '@/db/schema';
import { AgentPermissionsMatrix } from '@/components/manager/agent-permissions-matrix';

export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  const agents = await db
    .select({
      id: users.id,
      fullName: users.fullName,
      email: users.email,
      canApproveBookings: agentPermissions.canApproveBookings,
      canReviewKyc: agentPermissions.canReviewKyc,
      canEditPricing: agentPermissions.canEditPricing,
      canManagePromos: agentPermissions.canManagePromos,
      canViewRevenue: agentPermissions.canViewRevenue,
      canManageDrivers: agentPermissions.canManageDrivers,
      canEditSettings: agentPermissions.canEditSettings,
    })
    .from(users)
    .leftJoin(agentPermissions, eq(agentPermissions.userId, users.id))
    .where(eq(users.role, 'agent'))
    .orderBy(asc(users.fullName));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Agents &amp; permissions</h1>
        <p className="text-sm text-muted-foreground">
          Grant fine-grained permissions to agent users. Managers always have full access.
        </p>
      </div>

      {agents.length === 0 ? (
        <p className="text-sm text-muted-foreground">No agent users yet.</p>
      ) : (
        <div className="space-y-4">
          {agents.map((a) => (
            <AgentPermissionsMatrix
              key={a.id}
              agent={{
                id: a.id,
                fullName: a.fullName,
                email: a.email,
                canApproveBookings: a.canApproveBookings ?? false,
                canReviewKyc: a.canReviewKyc ?? false,
                canEditPricing: a.canEditPricing ?? false,
                canManagePromos: a.canManagePromos ?? false,
                canViewRevenue: a.canViewRevenue ?? false,
                canManageDrivers: a.canManageDrivers ?? false,
                canEditSettings: a.canEditSettings ?? false,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
