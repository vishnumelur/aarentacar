'use server';

import { revalidatePath } from 'next/cache';
import { isNull } from 'drizzle-orm';
import { db } from '@/db';
import { vehicles, vehicleTypes, branches } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { canAccessPortal } from '@/lib/auth/roles';
import {
  validateCsvRows,
  type CsvRow,
  type ParsedRow,
  type ValidationReport,
} from '@/lib/csv-import/validate';

async function buildLookups() {
  const types = await db.select().from(vehicleTypes);
  const bs = await db.select().from(branches);
  const existing = await db
    .select({ plate: vehicles.plate })
    .from(vehicles)
    .where(isNull(vehicles.deletedAt));
  return {
    typeSlugToId: new Map(types.map((t) => [t.slug, t.id])),
    branchNameToId: new Map(bs.map((b) => [b.name, b.id])),
    existingPlates: new Set(existing.map((e) => e.plate.toUpperCase())),
  };
}

export async function validateCsvServer(rows: CsvRow[]): Promise<ValidationReport> {
  const user = await getCurrentUser();
  if (!user || !canAccessPortal(user.role, 'manager')) {
    return { ok: false, totalRows: 0, errors: 0, rows: [] };
  }
  const lookups = await buildLookups();
  return validateCsvRows(rows, lookups);
}

export async function commitCsvImport(rows: ParsedRow[]) {
  const user = await getCurrentUser();
  if (!user || !canAccessPortal(user.role, 'manager')) {
    return { ok: false as const, error: 'forbidden' };
  }
  if (rows.length === 0) return { ok: false as const, error: 'empty' };
  await db.insert(vehicles).values(rows);
  revalidatePath('/manager/fleet');
  return { ok: true as const, inserted: rows.length };
}
