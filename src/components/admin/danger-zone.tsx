'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { dropTable, purgeOldData } from '@/lib/actions/danger';

export function DangerZone({ tables }: { tables: readonly string[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dropConfirm, setDropConfirm] = useState('');
  const [table, setTable] = useState(tables[0] ?? '');
  const [purgeConfirm, setPurgeConfirm] = useState('');
  const [days, setDays] = useState('365');

  function onDrop() {
    startTransition(async () => {
      const fd = new FormData();
      fd.set('table', table);
      fd.set('confirm', dropConfirm);
      const res = await dropTable(fd);
      if (res.ok) {
        toast.success(res.message);
        setDropConfirm('');
        router.refresh();
      } else {
        toast.error(
          res.error === 'confirmation_mismatch' ? 'Type DROP to confirm.' : 'Drop failed.',
        );
      }
    });
  }

  function onPurge() {
    startTransition(async () => {
      const fd = new FormData();
      fd.set('days', days);
      fd.set('confirm', purgeConfirm);
      const res = await purgeOldData(fd);
      if (res.ok) {
        toast.success(res.message);
        setPurgeConfirm('');
        router.refresh();
      } else {
        toast.error(
          res.error === 'confirmation_mismatch'
            ? 'Type DROP to confirm.'
            : res.error === 'invalid_input'
              ? 'Minimum 30 days.'
              : 'Purge failed.',
        );
      }
    });
  }

  return (
    <div className="space-y-6">
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-destructive text-base">Drop a table</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-muted-foreground text-sm">
            Irreversible. Only non-core tables are listed. Type{' '}
            <code className="font-mono">DROP</code> to confirm.
          </p>
          <select
            value={table}
            onChange={(e) => setTable(e.target.value)}
            className="h-9 rounded-md border px-2 text-sm"
          >
            {tables.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <div className="space-y-1">
            <Label htmlFor="dropConfirm">Confirmation</Label>
            <Input
              id="dropConfirm"
              value={dropConfirm}
              onChange={(e) => setDropConfirm(e.target.value)}
              placeholder="DROP"
            />
          </div>
          <Button
            variant="destructive"
            disabled={pending || dropConfirm !== 'DROP'}
            onClick={onDrop}
          >
            Drop {table}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-destructive text-base">Purge old data (PDPL)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-muted-foreground text-sm">
            Delete cancelled/completed bookings with no activity older than N days
            (min 30). Type <code className="font-mono">DROP</code> to confirm.
          </p>
          <div className="space-y-1">
            <Label htmlFor="days">Older than (days)</Label>
            <Input
              id="days"
              type="number"
              min={30}
              value={days}
              onChange={(e) => setDays(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="purgeConfirm">Confirmation</Label>
            <Input
              id="purgeConfirm"
              value={purgeConfirm}
              onChange={(e) => setPurgeConfirm(e.target.value)}
              placeholder="DROP"
            />
          </div>
          <Button
            variant="destructive"
            disabled={pending || purgeConfirm !== 'DROP'}
            onClick={onPurge}
          >
            Purge old data
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
