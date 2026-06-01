'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { bulkPriceUpdate } from '@/lib/actions/vehicles';

type RateKind = 'hourly' | 'daily' | 'weekly' | 'monthly';
type Mode = 'percent' | 'fixed';

export function BulkPriceDialog({
  open,
  onOpenChange,
  vehicleIds,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  vehicleIds: string[];
}) {
  const router = useRouter();
  const [rateKind, setRateKind] = useState<RateKind>('daily');
  const [mode, setMode] = useState<Mode>('percent');
  const [delta, setDelta] = useState('10');
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function onApply() {
    setMsg(null);
    start(async () => {
      const res = await bulkPriceUpdate({
        vehicleIds,
        rateKind,
        mode,
        delta: Number(delta),
      });
      if (!res.ok) {
        setMsg(`Error: ${res.error}`);
        return;
      }
      setMsg(`Updated ${res.updated} rate ${res.updated === 1 ? 'card' : 'cards'}.`);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Bulk price update</DialogTitle>
          <DialogDescription>
            Apply a percent or fixed AED delta to every matching rate card across the{' '}
            {vehicleIds.length} selected vehicle{vehicleIds.length === 1 ? '' : 's'}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Rate kind</Label>
            <select
              value={rateKind}
              onChange={(e) => setRateKind(e.target.value as RateKind)}
              className="w-full rounded-md border px-3 py-2 text-sm"
            >
              <option value="hourly">Hourly</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label>Mode</Label>
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="mode"
                  value="percent"
                  checked={mode === 'percent'}
                  onChange={() => setMode('percent')}
                />
                Percent (%)
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="mode"
                  value="fixed"
                  checked={mode === 'fixed'}
                  onChange={() => setMode('fixed')}
                />
                Fixed (AED)
              </label>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="delta">
              Delta {mode === 'percent' ? '(percent — use negative to discount)' : '(AED — negative discounts)'}
            </Label>
            <Input
              id="delta"
              type="number"
              value={delta}
              onChange={(e) => setDelta(e.target.value)}
              step="any"
            />
          </div>

          {msg && <p className="text-sm">{msg}</p>}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={onApply} disabled={pending || !delta}>
            {pending ? 'Applying…' : 'Apply update'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
