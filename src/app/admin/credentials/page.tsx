import { redirect } from 'next/navigation';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { auditLogs } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { AdminPage } from '@/components/admin/admin-page';
import {
  CredentialCard,
  type FieldState,
  type AuditEntry,
} from '@/components/admin/credential-card';
import { listCredentials } from '@/lib/credentials/store';
import {
  PROVIDER_FIELDS,
  PROVIDER_LABELS,
  type CredentialProvider,
} from '@/lib/credentials/types';
import { TESTABLE_PROVIDERS } from '@/lib/credentials/test-connection';

export const dynamic = 'force-dynamic';

const PROVIDERS: CredentialProvider[] = ['stripe', 'tabby', 'mapbox', 'smtp', 'glitchtip'];

export default async function CredentialsPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'superadmin') redirect('/login');

  const stored = await listCredentials();
  // lastFour by `${provider}:${key}` (live env only — the UI manages live keys).
  const lastFourBy = new Map<string, string | null>();
  for (const c of stored) {
    if (c.env === 'live') lastFourBy.set(`${c.provider}:${c.keyName}`, c.lastFour);
  }

  const events = await db
    .select({
      action: auditLogs.action,
      targetId: auditLogs.targetId,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .where(eq(auditLogs.action, 'credential.set'))
    .orderBy(desc(auditLogs.createdAt))
    .limit(50);

  return (
    <AdminPage title="Provider Credentials">
      <p className="text-sm text-muted-foreground mb-6 max-w-2xl">
        Paste API keys for each provider. Values are encrypted with AES-256-GCM
        and picked up by the app within 30 seconds — no restart needed. Keys
        left blank fall back to environment variables.
      </p>
      <div className="grid gap-6 md:grid-cols-2 max-w-4xl">
        {PROVIDERS.map((provider) => {
          const fields: FieldState[] = PROVIDER_FIELDS[provider].map((f) => ({
            key: f.key,
            label: f.label,
            secret: f.secret,
            lastFour: lastFourBy.get(`${provider}:${f.key}`) ?? null,
          }));
          const recentEvents: AuditEntry[] = events
            .filter((e) => e.targetId?.startsWith(`${provider}.`))
            .slice(0, 5)
            .map((e) => ({
              action: e.action,
              targetId: e.targetId,
              at: e.createdAt.toISOString(),
            }));
          return (
            <CredentialCard
              key={provider}
              provider={provider}
              label={PROVIDER_LABELS[provider]}
              fields={fields}
              testable={TESTABLE_PROVIDERS.includes(provider)}
              recentEvents={recentEvents}
            />
          );
        })}
      </div>
    </AdminPage>
  );
}
