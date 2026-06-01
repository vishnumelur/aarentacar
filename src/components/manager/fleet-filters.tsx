'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export function FleetFilters({
  categories,
  types,
}: {
  categories: Array<{ id: string; nameEn: string }>;
  types: Array<{ id: string; nameEn: string; categoryId: string }>;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [q, setQ] = useState(sp?.get('q') ?? '');

  useEffect(() => {
    const t = setTimeout(() => update('q', q), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function update(name: string, value: string) {
    const next = new URLSearchParams(sp?.toString() ?? '');
    if (value) next.set(name, value);
    else next.delete(name);
    router.replace(`/manager/fleet?${next.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search make / model / plate…"
        className="w-64"
      />
      <select
        defaultValue={sp?.get('status') ?? ''}
        onChange={(e) => update('status', e.target.value)}
        className="rounded-md border px-3 py-2 text-sm"
      >
        <option value="">All statuses</option>
        <option value="active">Active</option>
        <option value="maintenance">Maintenance</option>
        <option value="retired">Retired</option>
      </select>
      <select
        defaultValue={sp?.get('categoryId') ?? ''}
        onChange={(e) => update('categoryId', e.target.value)}
        className="rounded-md border px-3 py-2 text-sm"
      >
        <option value="">All categories</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nameEn}
          </option>
        ))}
      </select>
      <select
        defaultValue={sp?.get('typeId') ?? ''}
        onChange={(e) => update('typeId', e.target.value)}
        className="rounded-md border px-3 py-2 text-sm"
      >
        <option value="">All types</option>
        {types.map((t) => (
          <option key={t.id} value={t.id}>
            {t.nameEn}
          </option>
        ))}
      </select>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          setQ('');
          router.replace('/manager/fleet');
        }}
      >
        Reset
      </Button>
    </div>
  );
}
