import { redirect } from 'next/navigation';
import { inArray } from 'drizzle-orm';
import { db } from '@/db';
import { featureFlags } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { AdminPage } from '@/components/admin/admin-page';
import { Card, CardContent } from '@/components/ui/card';
import { FeatureFlagToggle } from '@/components/admin/feature-flag-toggle';
import {
  FEATURE_FLAG_KEYS,
  FEATURE_FLAG_DESCRIPTIONS,
} from '@/lib/feature-flags';

export const dynamic = 'force-dynamic';

const LABELS: Record<string, string> = {
  'live-tracking': 'Live Tracking',
  'customer-ratings': 'Customer Ratings',
  'loyalty-points': 'Loyalty Points',
  'corporate-accounts': 'Corporate Accounts',
  'maintenance-mode': 'Maintenance Mode',
};

export default async function FeatureFlagsPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'superadmin') redirect('/login');

  const rows = await db
    .select({ key: featureFlags.key, enabled: featureFlags.enabled })
    .from(featureFlags)
    .where(inArray(featureFlags.key, [...FEATURE_FLAG_KEYS]));
  const enabledBy = new Map(rows.map((r) => [r.key, r.enabled]));

  return (
    <AdminPage title="Feature Flags">
      <p className="text-muted-foreground mb-6 max-w-2xl text-sm">
        Toggles take effect within 30 seconds (cache TTL). Maintenance mode shows
        a site-wide banner and blocks new bookings.
      </p>
      <Card className="max-w-2xl">
        <CardContent className="py-2">
          {FEATURE_FLAG_KEYS.map((key) => (
            <FeatureFlagToggle
              key={key}
              flagKey={key}
              label={LABELS[key] ?? key}
              description={FEATURE_FLAG_DESCRIPTIONS[key]}
              initialEnabled={enabledBy.get(key) ?? false}
            />
          ))}
        </CardContent>
      </Card>
    </AdminPage>
  );
}
