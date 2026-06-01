'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

function tomorrowIso(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  return toLocalDatetimeValue(d);
}

function inDaysIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(10, 0, 0, 0);
  return toLocalDatetimeValue(d);
}

function toLocalDatetimeValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function SearchWidget() {
  const router = useRouter();
  const [category, setCategory] = useState<'car' | 'limousine'>('car');
  const [pickup, setPickup] = useState(tomorrowIso());
  const [ret, setRet] = useState(inDaysIso(4));

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const params = new URLSearchParams({
      category,
      pickup: new Date(pickup).toISOString(),
      return: new Date(ret).toISOString(),
    });
    router.push(`/cars?${params.toString()}`);
  }

  return (
    <form
      onSubmit={onSubmit}
      className="grid gap-4 rounded-lg border bg-card p-6 shadow-sm md:grid-cols-[1fr_1fr_1fr_auto]"
    >
      <div className="space-y-2">
        <Label>Category</Label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setCategory('car')}
            className={`flex-1 rounded-md border px-3 py-2 text-sm transition ${
              category === 'car'
                ? 'border-primary bg-primary text-primary-foreground'
                : 'bg-card hover:bg-muted'
            }`}
          >
            Car
          </button>
          <button
            type="button"
            onClick={() => setCategory('limousine')}
            className={`flex-1 rounded-md border px-3 py-2 text-sm transition ${
              category === 'limousine'
                ? 'border-primary bg-primary text-primary-foreground'
                : 'bg-card hover:bg-muted'
            }`}
          >
            Limousine
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="pickup">Pickup</Label>
        <Input
          id="pickup"
          type="datetime-local"
          value={pickup}
          onChange={(e) => setPickup(e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="return">Return</Label>
        <Input
          id="return"
          type="datetime-local"
          value={ret}
          onChange={(e) => setRet(e.target.value)}
          required
        />
      </div>

      <div className="flex items-end">
        <Button type="submit" size="lg" className="w-full md:w-auto">
          Search
        </Button>
      </div>
    </form>
  );
}
