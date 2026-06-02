import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { featureFlags } from '@/db/schema';
import { cachedFeatureLookup } from './cache';

/**
 * Phase-1 feature flags (Plan #11, spec §3.1). The canonical list the cockpit
 * renders + seeds. `maintenance-mode` additionally gates new bookings and
 * shows a site-wide banner.
 */
export const FEATURE_FLAG_KEYS = [
  'live-tracking',
  'customer-ratings',
  'loyalty-points',
  'corporate-accounts',
  'maintenance-mode',
] as const;

export type FeatureFlagKey = (typeof FEATURE_FLAG_KEYS)[number];

export const FEATURE_FLAG_DESCRIPTIONS: Record<FeatureFlagKey, string> = {
  'live-tracking': 'Swiggy-style live driver map for customers.',
  'customer-ratings': 'Post-rental ratings & reviews (Phase 2).',
  'loyalty-points': 'Loyalty points programme (Phase 2).',
  'corporate-accounts': 'Long-term & corporate billing accounts (Phase 2).',
  'maintenance-mode': 'Show a maintenance banner and block new bookings.',
};

/**
 * Read a flag, cached for 30s. Unknown / unseeded keys are treated as disabled.
 */
export async function isFeatureEnabled(key: string): Promise<boolean> {
  return cachedFeatureLookup(key, async () => {
    const [row] = await db
      .select({ enabled: featureFlags.enabled })
      .from(featureFlags)
      .where(eq(featureFlags.key, key))
      .limit(1);
    return row?.enabled ?? false;
  });
}
