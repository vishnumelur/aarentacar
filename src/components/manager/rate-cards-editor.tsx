'use client';

import { useTransition, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { VehicleRate } from '@/db/schema';
import { createRate, deleteRate } from '@/lib/actions/vehicles';

type RateKind = 'hourly' | 'daily' | 'weekly' | 'monthly' | 'package';

export function RateCardsEditor({
  vehicleId,
  rates,
}: {
  vehicleId: string;
  rates: VehicleRate[];
}) {
  const [pending, start] = useTransition();
  const [kind, setKind] = useState<RateKind>('daily');
  const [err, setErr] = useState<string | null>(null);

  function onAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    fd.set('vehicleId', vehicleId);
    start(async () => {
      const res = await createRate(fd);
      if (!res.ok) setErr(res.error);
      else form.reset();
    });
  }

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-medium">Rate cards</h2>

      <div className="rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left">
            <tr>
              <th className="px-4 py-2">Kind</th>
              <th className="px-4 py-2">Price (AED)</th>
              <th className="px-4 py-2">Package name</th>
              <th className="px-4 py-2">Hours</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rates.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                  No rates yet. Add one below.
                </td>
              </tr>
            )}
            {rates.map((r) => (
              <tr key={r.id} className="border-b last:border-b-0">
                <td className="px-4 py-2 capitalize">{r.rateKind}</td>
                <td className="px-4 py-2">{r.priceAed.toLocaleString()}</td>
                <td className="px-4 py-2">{r.packageName ?? '—'}</td>
                <td className="px-4 py-2">{r.packageHours ?? '—'}</td>
                <td className="px-4 py-2 text-right">
                  <form action={deleteRate} className="inline">
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="vehicleId" value={vehicleId} />
                    <Button type="submit" size="sm" variant="ghost">
                      Delete
                    </Button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form onSubmit={onAdd} className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <label className="text-xs">Kind</label>
          <select
            name="rateKind"
            value={kind}
            onChange={(e) => setKind(e.target.value as RateKind)}
            className="rounded-md border px-3 py-2 text-sm"
          >
            <option value="hourly">Hourly</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="package">Package</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs">Price (AED)</label>
          <Input type="number" name="priceAed" required className="w-32" min={1} />
        </div>
        {kind === 'package' && (
          <>
            <div className="space-y-1">
              <label className="text-xs">Package name</label>
              <Input name="packageName" required className="w-48" />
            </div>
            <div className="space-y-1">
              <label className="text-xs">Hours</label>
              <Input type="number" name="packageHours" className="w-24" min={1} />
            </div>
            <div className="min-w-[200px] flex-1 space-y-1">
              <label className="text-xs">Description</label>
              <Input name="packageDescription" />
            </div>
          </>
        )}
        <Button type="submit" disabled={pending} size="sm">
          {pending ? 'Adding…' : 'Add rate'}
        </Button>
        {err && <span className="text-xs text-destructive">{err}</span>}
      </form>
    </section>
  );
}
