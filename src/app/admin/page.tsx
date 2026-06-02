import { AdminPage } from '@/components/admin/admin-page';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getSystemHealth } from '@/lib/admin/system-health';
import { getMailStats } from '@/lib/mail/stats';
import { HealthActions } from '@/components/admin/health-actions';

export const dynamic = 'force-dynamic';

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-block h-2.5 w-2.5 rounded-full ${ok ? 'bg-green-500' : 'bg-red-500'}`}
      aria-label={ok ? 'healthy' : 'unhealthy'}
    />
  );
}

export default async function AdminHome() {
  const health = await getSystemHealth();
  const mail = await getMailStats(24);

  return (
    <AdminPage title="System Health">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-2">
            <CardTitle className="text-base">Database</CardTitle>
            <StatusDot ok={health.db.ok} />
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">
            {health.db.ok ? `Reachable · ${health.db.latencyMs ?? '?'} ms` : 'Unreachable'}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between gap-2">
            <CardTitle className="text-base">Job Queue (pg-boss)</CardTitle>
            <StatusDot ok={health.jobs.ok} />
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">
            {health.jobs.ok
              ? `${health.jobs.pending ?? 0} pending job(s)`
              : 'Worker / boss unreachable'}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between gap-2">
            <CardTitle className="text-base">Errors (24h)</CardTitle>
            <StatusDot ok={health.errors.failedLast24h === 0} />
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">
            {health.errors.failedLast24h} failed action(s) logged
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between gap-2">
            <CardTitle className="text-base">Object Storage (MinIO)</CardTitle>
            <StatusDot ok={health.minio.ok} />
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">{health.minio.note}</CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between gap-2">
            <CardTitle className="text-base">Mail (24h)</CardTitle>
            <StatusDot ok={mail.failed === 0 && mail.bounceRate < 0.05} />
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">
            <div>sent: {mail.sent}</div>
            <div>failed: {mail.failed}</div>
            <div>bounced: {mail.bounced}</div>
            <div>bounce rate: {(mail.bounceRate * 100).toFixed(1)}%</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Build</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">
            <div>
              SHA: <code className="font-mono">{health.build.gitSha}</code>
            </div>
            <div>Env: {health.build.nodeEnv}</div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">Quick actions</h2>
        <HealthActions />
      </div>
    </AdminPage>
  );
}
