import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { AdminPage } from '@/components/admin/admin-page';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { queryAuditLogs } from '@/lib/admin/audit-query';

export const dynamic = 'force-dynamic';

type SP = Promise<Record<string, string | string[] | undefined>>;

function first(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? '') : (v ?? '');
}

export default async function AuditLogsPage({ searchParams }: { searchParams: SP }) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'superadmin') redirect('/login');

  const sp = await searchParams;
  const filter = {
    actorEmail: first(sp.actorEmail) || undefined,
    action: first(sp.action) || undefined,
    targetType: first(sp.targetType) || undefined,
    from: first(sp.from) || undefined,
    to: first(sp.to) || undefined,
    limit: 200,
  };
  const rows = await queryAuditLogs(filter);

  const exportQs = new URLSearchParams();
  for (const [k, v] of Object.entries(filter)) {
    if (v && k !== 'limit') exportQs.set(k, String(v));
  }

  return (
    <AdminPage title="Audit Logs">
      <p className="text-muted-foreground mb-4 max-w-2xl text-sm">
        Immutable, append-only record of privileged actions. Read-only.
      </p>

      <form method="get" className="mb-4 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="text-muted-foreground mb-1 block">Actor email</span>
          <input
            name="actorEmail"
            defaultValue={filter.actorEmail ?? ''}
            className="h-9 rounded-md border px-2 text-sm"
          />
        </label>
        <label className="text-sm">
          <span className="text-muted-foreground mb-1 block">Action</span>
          <input
            name="action"
            defaultValue={filter.action ?? ''}
            placeholder="e.g. booking."
            className="h-9 rounded-md border px-2 text-sm"
          />
        </label>
        <label className="text-sm">
          <span className="text-muted-foreground mb-1 block">Target type</span>
          <input
            name="targetType"
            defaultValue={filter.targetType ?? ''}
            className="h-9 rounded-md border px-2 text-sm"
          />
        </label>
        <label className="text-sm">
          <span className="text-muted-foreground mb-1 block">From</span>
          <input
            type="date"
            name="from"
            defaultValue={filter.from ?? ''}
            className="h-9 rounded-md border px-2 text-sm"
          />
        </label>
        <label className="text-sm">
          <span className="text-muted-foreground mb-1 block">To</span>
          <input
            type="date"
            name="to"
            defaultValue={filter.to ?? ''}
            className="h-9 rounded-md border px-2 text-sm"
          />
        </label>
        <Button type="submit">Filter</Button>
        <a href={`/admin/audit-logs/export?${exportQs.toString()}`}>
          <Button type="button" variant="outline">
            Export CSV
          </Button>
        </a>
      </form>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="p-2 font-medium">Time (UTC)</th>
                <th className="p-2 font-medium">Actor</th>
                <th className="p-2 font-medium">Action</th>
                <th className="p-2 font-medium">Target</th>
                <th className="p-2 font-medium">Payload</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-muted-foreground p-4 text-center">
                    No matching audit entries.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="border-t align-top">
                  <td className="p-2 whitespace-nowrap font-mono text-xs">
                    {r.createdAt.toISOString().replace('T', ' ').slice(0, 19)}
                  </td>
                  <td className="p-2">{r.actorEmail ?? 'system'}</td>
                  <td className="p-2 font-mono text-xs">{r.action}</td>
                  <td className="p-2 text-xs">
                    {r.targetType ? `${r.targetType}${r.targetId ? `:${r.targetId.slice(0, 8)}` : ''}` : '—'}
                  </td>
                  <td className="text-muted-foreground max-w-xs truncate p-2 font-mono text-xs">
                    {r.payload ? JSON.stringify(r.payload) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </AdminPage>
  );
}
