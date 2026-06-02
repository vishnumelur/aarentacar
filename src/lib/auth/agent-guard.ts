import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { agentPermissions, type User } from '@/db/schema';
import { canAccessPortal, canAgent, type AgentPermissionKey } from './roles';

/**
 * Server-side gate combining manager-portal access with a fine-grained
 * sub-permission. Managers/superadmins always pass. Agents pass only when
 * their `agent_permissions` row has the matching flag. Loads the row lazily
 * (only for agents, since other roles short-circuit in `canAgent`).
 */
export async function userCanAgent(
  user: User | null,
  permission: AgentPermissionKey,
): Promise<boolean> {
  if (!user) return false;
  if (!canAccessPortal(user.role, 'manager')) return false;
  if (user.role !== 'agent') return canAgent(user.role, permission, null);

  const [perms] = await db
    .select()
    .from(agentPermissions)
    .where(eq(agentPermissions.userId, user.id))
    .limit(1);
  return canAgent(user.role, permission, perms ?? null);
}
