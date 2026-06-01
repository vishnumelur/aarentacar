'use client';

import { useTransition, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Vehicle, VehicleType, Branch } from '@/db/schema';
import { createVehicle, updateVehicle } from '@/lib/actions/vehicles';

export function VehicleForm({
  vehicle,
  types,
  branches,
}: {
  vehicle?: Vehicle;
  types: VehicleType[];
  branches: Branch[];
}) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    setOk(false);
    const fd = new FormData(e.currentTarget);
    if (vehicle) fd.set('id', vehicle.id);
    start(async () => {
      const res = vehicle ? await updateVehicle(fd) : await createVehicle(fd);
      if (res && !res.ok) setErr(res.error);
      else if (res && res.ok) setOk(true);
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="grid max-w-3xl grid-cols-1 gap-4 md:grid-cols-2"
    >
      <Field label="Type" name="typeId">
        <select
          name="typeId"
          required
          defaultValue={vehicle?.typeId ?? ''}
          className="w-full rounded-md border px-3 py-2 text-sm"
        >
          <option value="" disabled>
            Pick a type…
          </option>
          {types.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nameEn}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Branch" name="branchId">
        <select
          name="branchId"
          defaultValue={vehicle?.branchId ?? ''}
          className="w-full rounded-md border px-3 py-2 text-sm"
        >
          <option value="">— Unassigned —</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Make" name="make">
        <Input name="make" defaultValue={vehicle?.make ?? ''} required />
      </Field>
      <Field label="Model" name="model">
        <Input name="model" defaultValue={vehicle?.model ?? ''} required />
      </Field>
      <Field label="Year" name="year">
        <Input
          type="number"
          name="year"
          defaultValue={vehicle?.year ?? new Date().getFullYear()}
          required
        />
      </Field>
      <Field label="Plate" name="plate">
        <Input name="plate" defaultValue={vehicle?.plate ?? ''} required />
      </Field>
      <Field label="Color" name="color">
        <Input name="color" defaultValue={vehicle?.color ?? ''} />
      </Field>
      <Field label="Transmission" name="transmission">
        <select
          name="transmission"
          defaultValue={vehicle?.transmission ?? 'automatic'}
          className="w-full rounded-md border px-3 py-2 text-sm"
        >
          <option value="automatic">Automatic</option>
          <option value="manual">Manual</option>
        </select>
      </Field>
      <Field label="Seats" name="seats">
        <Input type="number" name="seats" defaultValue={vehicle?.seats ?? 5} required />
      </Field>
      <Field label="Doors" name="doors">
        <Input type="number" name="doors" defaultValue={vehicle?.doors ?? 4} required />
      </Field>
      <Field label="Fuel type" name="fuelType">
        <select
          name="fuelType"
          defaultValue={vehicle?.fuelType ?? 'petrol'}
          className="w-full rounded-md border px-3 py-2 text-sm"
        >
          <option value="petrol">Petrol</option>
          <option value="diesel">Diesel</option>
          <option value="hybrid">Hybrid</option>
          <option value="electric">Electric</option>
        </select>
      </Field>
      <Field label="Status" name="status">
        <select
          name="status"
          defaultValue={vehicle?.status ?? 'active'}
          className="w-full rounded-md border px-3 py-2 text-sm"
        >
          <option value="active">Active</option>
          <option value="maintenance">Maintenance</option>
          <option value="retired">Retired</option>
        </select>
      </Field>
      <Field label="Primary photo URL" name="primaryPhotoUrl" className="md:col-span-2">
        <Input name="primaryPhotoUrl" defaultValue={vehicle?.primaryPhotoUrl ?? ''} />
        <p className="mt-1 text-xs text-muted-foreground">
          Use the photo uploader on the detail page after creating to fill this automatically.
        </p>
      </Field>
      <Field label="Notes" name="notes" className="md:col-span-2">
        <textarea
          name="notes"
          defaultValue={vehicle?.notes ?? ''}
          rows={3}
          className="w-full rounded-md border px-3 py-2 text-sm"
        />
      </Field>
      {err && <p className="text-sm text-destructive md:col-span-2">Error: {err}</p>}
      {ok && <p className="text-sm text-green-600 md:col-span-2">Saved.</p>}
      <div className="flex gap-2 md:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? '…' : vehicle ? 'Save changes' : 'Create vehicle'}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  children,
  className,
}: {
  label: string;
  name: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-2 ${className ?? ''}`}>
      <Label htmlFor={name}>{label}</Label>
      {children}
    </div>
  );
}
