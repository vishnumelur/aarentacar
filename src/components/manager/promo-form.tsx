'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createPromo, updatePromo } from '@/lib/actions/promos';

export interface PromoFormValues {
  id?: string;
  code: string;
  kind: 'percent' | 'fixed';
  value: number;
  minAmountAed: number;
  maxUses: number | null;
  validFrom: string; // yyyy-mm-dd
  validTo: string | null;
  appliesToCategories: string[] | null;
  active: boolean;
}

interface Props {
  initial?: PromoFormValues;
}

export function PromoForm({ initial }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const isEdit = Boolean(initial?.id);

  const [kind, setKind] = useState<'percent' | 'fixed'>(initial?.kind ?? 'percent');

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res = isEdit ? await updatePromo(fd) : await createPromo(fd);
      if (res.ok) {
        toast.success(isEdit ? 'Promo updated.' : 'Promo created.');
        router.push('/manager/promos');
        router.refresh();
      } else {
        toast.error(`Failed: ${res.error}`);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="max-w-xl space-y-4 rounded-lg border bg-card p-6">
      {isEdit && <input type="hidden" name="id" value={initial!.id} />}

      <div className="space-y-1.5">
        <Label htmlFor="code">Code</Label>
        <Input id="code" name="code" defaultValue={initial?.code ?? ''} required maxLength={40} placeholder="SUMMER25" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="kind">Kind</Label>
          <select
            id="kind"
            name="kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as 'percent' | 'fixed')}
            className="h-8 w-full rounded-lg border border-border bg-background px-2.5 text-sm"
          >
            <option value="percent">Percent (%)</option>
            <option value="fixed">Fixed (AED)</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="value">{kind === 'percent' ? 'Percent off' : 'Amount off (AED)'}</Label>
          <Input id="value" name="value" type="number" min={1} defaultValue={initial?.value ?? ''} required />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="minAmountAed">Min subtotal (AED)</Label>
          <Input id="minAmountAed" name="minAmountAed" type="number" min={0} defaultValue={initial?.minAmountAed ?? 0} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="maxUses">Max uses (blank = unlimited)</Label>
          <Input id="maxUses" name="maxUses" type="number" min={1} defaultValue={initial?.maxUses ?? ''} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="validFrom">Valid from</Label>
          <Input id="validFrom" name="validFrom" type="date" defaultValue={initial?.validFrom ?? ''} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="validTo">Valid to (blank = no expiry)</Label>
          <Input id="validTo" name="validTo" type="date" defaultValue={initial?.validTo ?? ''} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="appliesToCategories">Category ids (comma-separated, blank = all)</Label>
        <Input
          id="appliesToCategories"
          name="appliesToCategories"
          defaultValue={initial?.appliesToCategories?.join(',') ?? ''}
          placeholder="leave blank for all categories"
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="active" defaultChecked={initial?.active ?? true} className="size-4" />
        Active
      </label>

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : isEdit ? 'Save changes' : 'Create promo'}
        </Button>
      </div>
    </form>
  );
}
