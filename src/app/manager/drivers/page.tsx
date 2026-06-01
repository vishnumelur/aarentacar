import Link from 'next/link';
import { asc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { users, driverProfiles } from '@/db/schema';
import { Button } from '@/components/ui/button';

const STATUS_TONES: Record<string, string> = {
  available: 'bg-green-100 text-green-900',
  on_duty: 'bg-blue-100 text-blue-900',
  off_duty: 'bg-muted text-muted-foreground',
  suspended: 'bg-destructive/10 text-destructive',
};

export default async function DriversListPage() {
  const rows = await db
    .select({
      userId: users.id,
      email: users.email,
      fullName: users.fullName,
      phone: users.phone,
      licenseNo: driverProfiles.licenseNo,
      licenseExpiry: driverProfiles.licenseExpiry,
      status: driverProfiles.status,
      lastPingAt: driverProfiles.lastPingAt,
    })
    .from(users)
    .innerJoin(driverProfiles, eq(driverProfiles.userId, users.id))
    .where(eq(users.role, 'driver'))
    .orderBy(asc(users.fullName));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Drivers</h1>
        <Link href="/manager/drivers/new">
          <Button>Add driver</Button>
        </Link>
      </div>

      <div className="rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">License</th>
              <th className="px-4 py-3">Expires</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  No drivers yet. <Link href="/manager/drivers/new" className="text-primary underline">Add one</Link>.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.userId} className="border-b last:border-b-0">
                <td className="px-4 py-3 font-medium">{r.fullName}</td>
                <td className="px-4 py-3 text-muted-foreground">{r.email}</td>
                <td className="px-4 py-3 font-mono text-xs">{r.licenseNo}</td>
                <td className="px-4 py-3 text-xs">{r.licenseExpiry}</td>
                <td className="px-4 py-3">
                  <span className={`rounded px-2 py-0.5 text-xs ${STATUS_TONES[r.status] ?? 'bg-muted'}`}>
                    {r.status.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/manager/drivers/${r.userId}`} className="text-primary underline">
                    Edit
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
