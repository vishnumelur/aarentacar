'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { CustomerProfile } from '@/db/schema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { saveCustomerProfile } from '@/lib/actions/customer-profile';

export function ProfileForm({ initial }: { initial?: CustomerProfile | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    setOk(false);
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res = await saveCustomerProfile(fd);
      if (!res.ok) {
        setErr(res.error);
      } else {
        setOk(true);
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="max-w-md space-y-4">
      <div className="space-y-2">
        <Label>Residency</Label>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="residency"
              value="tourist"
              defaultChecked={initial?.residency === 'tourist' || !initial}
              required
            />
            Tourist (visiting Dubai)
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="residency"
              value="resident"
              defaultChecked={initial?.residency === 'resident'}
            />
            UAE Resident
          </label>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="dateOfBirth">Date of birth</Label>
        <Input
          id="dateOfBirth"
          name="dateOfBirth"
          type="date"
          defaultValue={initial?.dateOfBirth ?? ''}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="nationality">Nationality</Label>
        <Input
          id="nationality"
          name="nationality"
          defaultValue={initial?.nationality ?? ''}
          placeholder="e.g. United Kingdom"
          required
        />
      </div>

      {err && (
        <p role="alert" className="text-sm text-destructive">
          {err === 'age_out_of_range' ? 'You must be 18 or older.' : err}
        </p>
      )}
      {ok && <p className="text-sm text-green-600">Saved.</p>}

      <Button type="submit" disabled={pending}>
        {pending ? '…' : 'Save profile'}
      </Button>
    </form>
  );
}
