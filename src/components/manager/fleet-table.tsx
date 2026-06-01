import Link from 'next/link';
import type { Vehicle, VehicleType } from '@/db/schema';

type Row = Vehicle & { type?: VehicleType | undefined };

export function FleetTable({ rows }: { rows: Row[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-12 text-center text-muted-foreground">
        No vehicles match.{' '}
        <Link href="/manager/fleet/new" className="text-primary underline">
          Add one
        </Link>
        .
      </div>
    );
  }
  return (
    <div className="rounded-lg border bg-card">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/50 text-left">
          <tr>
            <th className="px-4 py-3">Plate</th>
            <th className="px-4 py-3">Make / Model</th>
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3">Year</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((v) => (
            <tr key={v.id} className="border-b last:border-b-0">
              <td className="px-4 py-3 font-mono">{v.plate}</td>
              <td className="px-4 py-3">
                {v.make} {v.model}
              </td>
              <td className="px-4 py-3">{v.type?.nameEn ?? '—'}</td>
              <td className="px-4 py-3">{v.year}</td>
              <td className="px-4 py-3">
                <span className="rounded bg-muted px-2 py-0.5 text-xs capitalize">{v.status}</span>
              </td>
              <td className="px-4 py-3 text-right">
                <Link href={`/manager/fleet/${v.id}`} className="text-primary underline">
                  Edit
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
