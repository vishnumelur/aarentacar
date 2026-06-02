import Link from 'next/link';
import { desc } from 'drizzle-orm';
import { db } from '@/db';
import { promoCodes } from '@/db/schema';
import { buttonVariants } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

export default async function PromosPage() {
  const rows = await db.select().from(promoCodes).orderBy(desc(promoCodes.createdAt));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Promotions</h1>
          <p className="text-sm text-muted-foreground">Create and manage discount codes.</p>
        </div>
        <Link href="/manager/promos/new" className={buttonVariants()}>
          New promo
        </Link>
      </div>

      <div className="rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left">
            <tr>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Discount</th>
              <th className="px-4 py-3">Min amount</th>
              <th className="px-4 py-3">Used / Max</th>
              <th className="px-4 py-3">Validity</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                  No promo codes yet.
                </td>
              </tr>
            ) : (
              rows.map((p) => (
                <tr key={p.id} className="border-b last:border-0">
                  <td className="px-4 py-3">
                    <Link href={`/manager/promos/${p.id}`} className="font-mono font-medium text-primary underline">
                      {p.code}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    {p.kind === 'percent' ? `${p.value}%` : `AED ${p.value}`}
                  </td>
                  <td className="px-4 py-3">AED {p.minAmountAed}</td>
                  <td className="px-4 py-3">
                    {p.usedCount} / {p.maxUses ?? '∞'}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(p.validFrom).toLocaleDateString()} →{' '}
                    {p.validTo ? new Date(p.validTo).toLocaleDateString() : 'no expiry'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded px-2 py-0.5 text-xs ${p.active ? 'bg-green-100 text-green-800' : 'bg-muted text-muted-foreground'}`}>
                      {p.active ? 'active' : 'inactive'}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
