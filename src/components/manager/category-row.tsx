'use client';

import { useState, useTransition } from 'react';
import type { VehicleCategory } from '@/db/schema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { updateCategory } from '@/lib/actions/categories';

export function CategoryRow({ row }: { row: VehicleCategory }) {
  const [isPending, startTransition] = useTransition();
  const [advanceDays, setAdvanceDays] = useState(row.advanceBookMinDays);
  const [minAge, setMinAge] = useState(row.minDriverAge);
  const [deposit, setDeposit] = useState(row.defaultDepositAed);
  const [msg, setMsg] = useState<string | null>(null);

  function onSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await updateCategory(fd);
      setMsg(res.ok ? 'Saved.' : `Error: ${res.error}`);
    });
  }

  return (
    <tr className="border-b last:border-b-0">
      <td className="px-4 py-3 font-medium">
        {row.nameEn}
        <span className="ms-2 text-muted-foreground">/ {row.nameAr}</span>
      </td>
      <td className="px-4 py-3">
        <Input
          type="number"
          name="advanceBookMinDays"
          form={`f-${row.id}`}
          value={advanceDays}
          onChange={(e) => setAdvanceDays(Number(e.target.value))}
          className="w-24"
          min={0}
        />
      </td>
      <td className="px-4 py-3">
        <Input
          type="number"
          name="minDriverAge"
          form={`f-${row.id}`}
          value={minAge}
          onChange={(e) => setMinAge(Number(e.target.value))}
          className="w-24"
          min={18}
        />
      </td>
      <td className="px-4 py-3">
        <Input
          type="number"
          name="defaultDepositAed"
          form={`f-${row.id}`}
          value={deposit}
          onChange={(e) => setDeposit(Number(e.target.value))}
          className="w-32"
          min={0}
        />
      </td>
      <td className="px-4 py-3 text-right">
        <form id={`f-${row.id}`} onSubmit={onSave} className="inline-flex items-center gap-2">
          <input type="hidden" name="id" value={row.id} />
          <Button type="submit" size="sm" disabled={isPending}>
            {isPending ? '…' : 'Save'}
          </Button>
          {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
        </form>
      </td>
    </tr>
  );
}
