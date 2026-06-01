import { z } from 'zod';

export interface CsvRow {
  type_slug: string;
  branch_name: string;
  make: string;
  model: string;
  year: string;
  plate: string;
  color: string;
  transmission: string;
  seats: string;
  doors: string;
  fuel_type: string;
  status: string;
  primary_photo_url: string;
  notes: string;
}

export interface Lookups {
  typeSlugToId: Map<string, string>;
  branchNameToId: Map<string, string>;
  existingPlates: Set<string>;
}

const rowSchema = z.object({
  make: z.string().min(1).max(60),
  model: z.string().min(1).max(60),
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
  status: z.enum(['active', 'maintenance', 'retired']),
});

export interface ParsedRow {
  typeId: string;
  branchId: string | null;
  make: string;
  model: string;
  year: number;
  plate: string;
  color: string | null;
  transmission: 'automatic' | 'manual';
  seats: number;
  doors: number;
  fuelType: 'petrol' | 'diesel' | 'hybrid' | 'electric';
  status: 'active' | 'maintenance' | 'retired';
  primaryPhotoUrl: string | null;
  notes: string | null;
}

export interface ValidatedRow {
  index: number;
  raw: CsvRow;
  parsed: ParsedRow | null;
  error: string | null;
}

export interface ValidationReport {
  ok: boolean;
  totalRows: number;
  errors: number;
  rows: ValidatedRow[];
}

export function validateCsvRows(rows: CsvRow[], lookups: Lookups): ValidationReport {
  const result: ValidatedRow[] = [];
  const seenPlates = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i]!;
    const r: ValidatedRow = { index: i, raw, parsed: null, error: null };

    const typeId = lookups.typeSlugToId.get(raw.type_slug.trim());
    if (!typeId) {
      r.error = `unknown type_slug: ${raw.type_slug}`;
      result.push(r);
      continue;
    }

    const branchName = raw.branch_name.trim();
    let branchId: string | null = null;
    if (branchName) {
      const found = lookups.branchNameToId.get(branchName);
      if (!found) {
        r.error = `unknown branch_name: ${branchName}`;
        result.push(r);
        continue;
      }
      branchId = found;
    }

    const parsed = rowSchema.safeParse({
      make: raw.make,
      model: raw.model,
      year: raw.year,
      plate: raw.plate,
      color: raw.color || undefined,
      transmission: raw.transmission,
      seats: raw.seats,
      doors: raw.doors,
      fuelType: raw.fuel_type,
      status: raw.status,
    });
    if (!parsed.success) {
      r.error = parsed.error.issues
        .map((iss) => `${iss.path.join('.')}: ${iss.message}`)
        .join('; ');
      result.push(r);
      continue;
    }

    const plate = parsed.data.plate;
    if (seenPlates.has(plate)) {
      r.error = `plate_duplicate_in_csv: ${plate}`;
      result.push(r);
      continue;
    }
    if (lookups.existingPlates.has(plate)) {
      r.error = `plate_taken: ${plate}`;
      result.push(r);
      continue;
    }
    seenPlates.add(plate);

    r.parsed = {
      typeId,
      branchId,
      make: parsed.data.make,
      model: parsed.data.model,
      year: parsed.data.year,
      plate,
      color: parsed.data.color ?? null,
      transmission: parsed.data.transmission,
      seats: parsed.data.seats,
      doors: parsed.data.doors,
      fuelType: parsed.data.fuelType,
      status: parsed.data.status,
      primaryPhotoUrl: raw.primary_photo_url.trim() || null,
      notes: raw.notes.trim() || null,
    };
    result.push(r);
  }

  return {
    ok: result.every((r) => r.error === null),
    totalRows: result.length,
    errors: result.filter((r) => r.error !== null).length,
    rows: result,
  };
}
