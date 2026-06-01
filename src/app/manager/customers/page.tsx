import Link from 'next/link';
import { and, desc, eq, ilike, sql, type SQL } from 'drizzle-orm';
import { db } from '@/db';
import { users, customerDocuments } from '@/db/schema';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface SP {
  q?: string;
  status?: 'pending' | 'verified' | 'rejected' | 'unverified';
}

const STATUS_TONES: Record<string, string> = {
  unverified: 'bg-muted text-foreground',
  pending: 'bg-amber-100 text-amber-900',
  verified: 'bg-green-100 text-green-900',
  rejected: 'bg-destructive/10 text-destructive',
};

export default async function CustomersPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;

  const where: SQL[] = [eq(users.role, 'customer')];
  if (sp.q) where.push(ilike(users.email, `%${sp.q}%`));
  if (sp.status) where.push(eq(users.verificationStatus, sp.status));

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
      verificationStatus: users.verificationStatus,
      createdAt: users.createdAt,
      pendingCount: sql<number>`(
        SELECT count(*)::int FROM ${customerDocuments}
        WHERE ${customerDocuments.customerId} = ${users.id} AND ${customerDocuments.status} = 'pending'
      )`,
    })
    .from(users)
    .where(and(...where))
    .orderBy(desc(users.createdAt));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Customers</h1>
      </div>

      <form className="flex flex-wrap items-center gap-2" action="/manager/customers">
        <Input
          name="q"
          placeholder="Search email…"
          defaultValue={sp.q ?? ''}
          className="w-64"
        />
        <select
          name="status"
          defaultValue={sp.status ?? ''}
          className="rounded-md border px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          <option value="pending">Pending review</option>
          <option value="verified">Verified</option>
          <option value="rejected">Rejected</option>
          <option value="unverified">Unverified</option>
        </select>
        <Button type="submit" size="sm">
          Filter
        </Button>
        <Link href="/manager/customers" className="text-sm text-muted-foreground underline">
          Reset
        </Link>
      </form>

      <div className="rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left">
            <tr>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Pending docs</th>
              <th className="px-4 py-3">Joined</th>
              <th className="px-4 py-3 text-right"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  No customers match.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-b last:border-b-0">
                <td className="px-4 py-3 font-medium">{r.fullName}</td>
                <td className="px-4 py-3 text-muted-foreground">{r.email}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded px-2 py-0.5 text-xs ${
                      STATUS_TONES[r.verificationStatus] ?? 'bg-muted'
                    }`}
                  >
                    {r.verificationStatus}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {r.pendingCount > 0 ? (
                    <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-900">
                      {r.pendingCount}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {new Date(r.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/manager/customers/${r.id}`} className="text-primary underline">
                    Review
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
