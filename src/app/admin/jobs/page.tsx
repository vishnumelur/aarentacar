import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { AdminPage } from '@/components/admin/admin-page';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { JobRowActions } from '@/components/admin/job-row-actions';
import {
  listQueueSummaries,
  findRecentJobs,
  JOB_NAMES,
  type QueueSummary,
  type BrowsableJob,
} from '@/lib/jobs/queue';

export const dynamic = 'force-dynamic';

export default async function JobsPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'superadmin') redirect('/login');

  let summaries: QueueSummary[] = [];
  const recent: Array<{ name: string; jobs: BrowsableJob[] }> = [];
  let reachable = true;
  try {
    summaries = await listQueueSummaries();
    for (const name of Object.values(JOB_NAMES)) {
      recent.push({ name, jobs: await findRecentJobs(name, 20) });
    }
  } catch {
    reachable = false;
  }

  if (!reachable) {
    return (
      <AdminPage title="Jobs">
        <Card>
          <CardContent className="text-muted-foreground p-6 text-sm">
            pg-boss is not reachable. Start the worker with{' '}
            <code className="font-mono">pnpm worker:start</code> (or the{' '}
            <code className="font-mono">worker</code> compose service).
          </CardContent>
        </Card>
      </AdminPage>
    );
  }

  return (
    <AdminPage title="Jobs">
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {summaries.map((q) => (
          <Card key={q.name}>
            <CardHeader>
              <CardTitle className="text-sm">{q.name}</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground text-xs">
              <div>queued: {q.queued}</div>
              <div>active: {q.active}</div>
              <div>deferred: {q.deferred}</div>
              <div>total: {q.total}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {recent.map(({ name, jobs }) => (
        <div key={name} className="mb-8">
          <h2 className="mb-2 text-lg font-semibold">{name}</h2>
          <Card>
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="p-2 font-medium">Job ID</th>
                    <th className="p-2 font-medium">State</th>
                    <th className="p-2 font-medium">Created</th>
                    <th className="p-2 font-medium">Retries</th>
                    <th className="p-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-muted-foreground p-4 text-center">
                        No recent jobs.
                      </td>
                    </tr>
                  )}
                  {jobs.map((j) => (
                    <tr key={j.id} className="border-t">
                      <td className="p-2 font-mono text-xs">{j.id.slice(0, 8)}</td>
                      <td className="p-2">{j.state}</td>
                      <td className="p-2 font-mono text-xs">
                        {j.createdOn.toISOString().replace('T', ' ').slice(0, 19)}
                      </td>
                      <td className="p-2">{j.retryCount}</td>
                      <td className="p-2">
                        <JobRowActions name={j.name} id={j.id} state={j.state} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      ))}
    </AdminPage>
  );
}
