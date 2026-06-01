'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Vehicle, VehicleType } from '@/db/schema';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { BulkPriceDialog } from './bulk-price-dialog';

type Row = Vehicle & { type?: VehicleType | undefined };

export function FleetTable({ rows }: { rows: Row[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => (prev.size === rows.length ? new Set() : new Set(rows.map((r) => r.id))));
  }

  const allSelected = rows.length > 0 && selected.size === rows.length;

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
    <>
      {selected.size > 0 && (
        <div className="flex items-center justify-between rounded-md border bg-muted/40 px-4 py-2 text-sm">
          <div>
            {selected.size} vehicle{selected.size === 1 ? '' : 's'} selected
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              Bulk price update
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left">
            <tr>
              <th className="px-4 py-3">
                <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all" />
              </th>
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
                <td className="px-4 py-3">
                  <Checkbox
                    checked={selected.has(v.id)}
                    onCheckedChange={() => toggle(v.id)}
                    aria-label={`Select ${v.plate}`}
                  />
                </td>
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

      <BulkPriceDialog
        open={dialogOpen}
        onOpenChange={(next) => {
          setDialogOpen(next);
          if (!next) setSelected(new Set());
        }}
        vehicleIds={Array.from(selected)}
      />
    </>
  );
}
