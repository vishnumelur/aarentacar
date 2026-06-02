'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { featureFlags, auditLogs } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { invalidateFeatureFlag } from '@/lib/feature-flags/cache';
import {
  FEATURE_FLAG_KEYS,
  FEATURE_FLAG_DESCRIPTIONS,
  type FeatureFlagKey,
} from '@/lib/feature-flags';

export type ToggleFlagOutcome =
  | { ok: true; enabled: boolean }
  | { ok: false; error: 'forbidden' | 'invalid_input' };

/**
 * Toggle a feature flag (super-admin only). Upserts so a never-seeded key still
 * works, audits the change, and busts the 30s cache so it takes effect at once.
 */
export async function toggleFeatureFlag(formData: FormData): Promise<ToggleFlagOutcome> {
  const user = await getCurrentUser();
  if (!user || user.role !== 'superadmin') return { ok: false, error: 'forbidden' };

  const key = String(formData.get('key') ?? '') as FeatureFlagKey;
  const enabled = String(formData.get('enabled') ?? '') === 'true';
  if (!FEATURE_FLAG_KEYS.includes(key)) return { ok: false, error: 'invalid_input' };

  await db
    .insert(featureFlags)
    .values({
      key,
      enabled,
      description: FEATURE_FLAG_DESCRIPTIONS[key],
      updatedByUserId: user.id,
    })
    .onConflictDoUpdate({
      target: featureFlags.key,
      set: { enabled, updatedByUserId: user.id, updatedAt: new Date() },
    });

  await db.insert(auditLogs).values({
    actorUserId: user.id,
    action: 'feature_flag.toggled',
    targetType: 'feature_flag',
    targetId: key,
    payload: { enabled },
  });

  invalidateFeatureFlag(key);
  revalidatePath('/admin/feature-flags');
  return { ok: true, enabled };
}
