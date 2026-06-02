'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { eq, isNull, and } from 'drizzle-orm';
import { db } from '@/db';
import { vehicles, vehicleRates } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { canAccessPortal } from '@/lib/auth/roles';
import { userCanAgent } from '@/lib/auth/agent-guard';

const vehicleBase = z.object({
  typeId: z.uuid(),
  branchId: z
    .string()
    .optional()
    .transform((v) => (v ? v : null)),
  make: z.string().min(1).max(60).transform((s) => s.trim()),
  model: z.string().min(1).max(60).transform((s) => s.trim()),
  year: z.coerce.number().int().min(1980).max(new Date().getFullYear() + 1),
  plate: z
    .string()
    .min(1)
    .max(20)
    .transform((s) => s.toUpperCase().trim()),
  color: z.string().max(40).optional(),
  transmission: z.enum(['automatic', 'manual']),
  seats: z.coerce.number().int().min(1).max(60),
  doors: z.coerce.number().int().min(1).max(8),
  fuelType: z.enum(['petrol', 'diesel', 'hybrid', 'electric']),
  status: z.enum(['active', 'maintenance', 'retired']).default('active'),
  primaryPhotoUrl: z
    .string()
    .optional()
    .transform((v) => (v ? v : null)),
  notes: z.string().max(2000).optional(),
});

export async function createVehicle(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || !canAccessPortal(user.role, 'manager')) {
    return { ok: false as const, error: 'forbidden' };
  }
  const parsed = vehicleBase.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false as const, error: 'invalid_input' };
  }
  const existing = await db
    .select({ id: vehicles.id })
    .from(vehicles)
    .where(and(eq(vehicles.plate, parsed.data.plate), isNull(vehicles.deletedAt)))
    .limit(1);
  if (existing.length > 0) {
    return { ok: false as const, error: 'plate_taken' };
  }
  const [created] = await db
    .insert(vehicles)
    .values({
      typeId: parsed.data.typeId,
      branchId: parsed.data.branchId,
      make: parsed.data.make,
      model: parsed.data.model,
      year: parsed.data.year,
      plate: parsed.data.plate,
      color: parsed.data.color ?? null,
      transmission: parsed.data.transmission,
      seats: parsed.data.seats,
      doors: parsed.data.doors,
      fuelType: parsed.data.fuelType,
      status: parsed.data.status,
      primaryPhotoUrl: parsed.data.primaryPhotoUrl,
      notes: parsed.data.notes ?? null,
    })
    .returning({ id: vehicles.id });
  if (!created) return { ok: false as const, error: 'insert_failed' };
  revalidatePath('/manager/fleet');
  redirect(`/manager/fleet/${created.id}`);
}

export async function updateVehicle(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || !canAccessPortal(user.role, 'manager')) {
    return { ok: false as const, error: 'forbidden' };
  }
  const schema = vehicleBase.extend({ id: z.uuid() });
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false as const, error: 'invalid_input' };
  await db
    .update(vehicles)
    .set({
      typeId: parsed.data.typeId,
      branchId: parsed.data.branchId,
      make: parsed.data.make,
      model: parsed.data.model,
      year: parsed.data.year,
      plate: parsed.data.plate,
      color: parsed.data.color ?? null,
      transmission: parsed.data.transmission,
      seats: parsed.data.seats,
      doors: parsed.data.doors,
      fuelType: parsed.data.fuelType,
      status: parsed.data.status,
      primaryPhotoUrl: parsed.data.primaryPhotoUrl,
      notes: parsed.data.notes ?? null,
      updatedAt: new Date(),
    })
    .where(eq(vehicles.id, parsed.data.id));
  revalidatePath('/manager/fleet');
  revalidatePath(`/manager/fleet/${parsed.data.id}`);
  return { ok: true as const };
}

// Form-action shape: returns void so it can be passed directly to
// <form action={softDeleteVehicle}>. Errors throw (caught by Next's
// error boundary).
export async function softDeleteVehicle(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user || !canAccessPortal(user.role, 'manager')) {
    throw new Error('forbidden');
  }
  const id = formData.get('id');
  if (typeof id !== 'string') {
    throw new Error('invalid_input');
  }
  await db
    .update(vehicles)
    .set({ deletedAt: new Date(), status: 'retired' })
    .where(eq(vehicles.id, id));
  revalidatePath('/manager/fleet');
  redirect('/manager/fleet');
}

export async function setVehiclePrimaryPhoto(input: { vehicleId: string; key: string }) {
  const user = await getCurrentUser();
  if (!user || !canAccessPortal(user.role, 'manager')) {
    return { ok: false as const, error: 'forbidden' };
  }
  if (!input.vehicleId || !input.key) {
    return { ok: false as const, error: 'invalid_input' };
  }
  await db
    .update(vehicles)
    .set({ primaryPhotoUrl: input.key, updatedAt: new Date() })
    .where(eq(vehicles.id, input.vehicleId));
  revalidatePath(`/manager/fleet/${input.vehicleId}`);
  revalidatePath('/manager/fleet');
  return { ok: true as const };
}

const rateSchema = z.object({
  vehicleId: z.uuid(),
  rateKind: z.enum(['hourly', 'daily', 'weekly', 'monthly', 'package']),
  priceAed: z.coerce.number().int().min(1).max(1_000_000),
  packageName: z.string().max(120).optional(),
  packageHours: z.coerce.number().int().min(1).max(744).optional(),
  packageDescription: z.string().max(500).optional(),
});

export async function createRate(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || !(await userCanAgent(user, 'edit_pricing'))) {
    return { ok: false as const, error: 'forbidden' };
  }
  const parsed = rateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false as const, error: 'invalid_input' };
  if (parsed.data.rateKind === 'package' && !parsed.data.packageName) {
    return { ok: false as const, error: 'package_name_required' };
  }
  await db.insert(vehicleRates).values({
    vehicleId: parsed.data.vehicleId,
    rateKind: parsed.data.rateKind,
    priceAed: parsed.data.priceAed,
    packageName: parsed.data.packageName ?? null,
    packageHours: parsed.data.packageHours ?? null,
    packageDescription: parsed.data.packageDescription ?? null,
  });
  revalidatePath(`/manager/fleet/${parsed.data.vehicleId}`);
  return { ok: true as const };
}

// Form-action shape: returns void so it can be passed directly to
// <form action={deleteRate}>.
export async function deleteRate(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user || !(await userCanAgent(user, 'edit_pricing'))) {
    throw new Error('forbidden');
  }
  const id = formData.get('id');
  const vehicleId = formData.get('vehicleId');
  if (typeof id !== 'string' || typeof vehicleId !== 'string') {
    throw new Error('invalid_input');
  }
  await db.delete(vehicleRates).where(eq(vehicleRates.id, id));
  revalidatePath(`/manager/fleet/${vehicleId}`);
}

const bulkPriceSchema = z.object({
  vehicleIds: z.array(z.uuid()).min(1).max(500),
  rateKind: z.enum(['hourly', 'daily', 'weekly', 'monthly']),
  mode: z.enum(['percent', 'fixed']),
  delta: z.coerce.number(),
});

export async function bulkPriceUpdate(input: z.infer<typeof bulkPriceSchema>) {
  const user = await getCurrentUser();
  if (!user || !(await userCanAgent(user, 'edit_pricing'))) {
    return { ok: false as const, error: 'forbidden' };
  }
  const parsed = bulkPriceSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: 'invalid_input' };

  let updated = 0;
  await db.transaction(async (tx) => {
    for (const id of parsed.data.vehicleIds) {
      const existing = await tx
        .select()
        .from(vehicleRates)
        .where(and(eq(vehicleRates.vehicleId, id), eq(vehicleRates.rateKind, parsed.data.rateKind)));
      for (const r of existing) {
        const next =
          parsed.data.mode === 'percent'
            ? Math.max(1, Math.round(r.priceAed * (1 + parsed.data.delta / 100)))
            : Math.max(1, r.priceAed + Math.round(parsed.data.delta));
        await tx.update(vehicleRates).set({ priceAed: next }).where(eq(vehicleRates.id, r.id));
        updated++;
      }
    }
  });
  revalidatePath('/manager/fleet');
  return { ok: true as const, updated };
}
