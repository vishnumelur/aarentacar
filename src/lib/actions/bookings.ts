'use server';

import { z } from 'zod';
import { and, asc, eq, gt, inArray, isNull } from 'drizzle-orm';
import { db } from '@/db';
import {
  vehicles,
  vehicleTypes,
  vehicleCategories,
  vehicleRates,
  bookings,
  addons as addonsTable,
} from '@/db/schema';
import { hasOverlap, isActiveBookingStatus } from '@/lib/pricing/availability';
import { computeBestRate, type Rate, type RatePick } from '@/lib/pricing/compute-rate';

const searchSchema = z.object({
  categorySlug: z.enum(['car', 'limousine']).optional(),
  pickupAt: z.iso.datetime(),
  returnAt: z.iso.datetime(),
});

export interface SearchResult {
  vehicleId: string;
  make: string;
  model: string;
  year: number;
  primaryPhotoUrl: string | null;
  seats: number;
  doors: number;
  transmission: 'automatic' | 'manual';
  typeId: string;
  typeNameEn: string;
  typeNameAr: string;
  categoryId: string;
  categorySlug: string;
  pick: RatePick;
}

export type SearchVehiclesOutcome =
  | { ok: true; results: SearchResult[] }
  | {
      ok: false;
      error: 'invalid_input' | 'advance_book_violation' | 'returns_before_pickup';
      details?: { minAdvanceDays?: number };
    };

export async function searchVehicles(input: z.infer<typeof searchSchema>): Promise<SearchVehiclesOutcome> {
  const parsed = searchSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid_input' };

  const pickupAt = new Date(parsed.data.pickupAt);
  const returnAt = new Date(parsed.data.returnAt);
  if (returnAt <= pickupAt) return { ok: false, error: 'returns_before_pickup' };

  // Advance-book rule (per category)
  const cats = await db.select().from(vehicleCategories).orderBy(asc(vehicleCategories.sortOrder));
  const now = new Date();
  const daysToPickup = (pickupAt.getTime() - now.getTime()) / 86_400_000;

  let categoryFilterId: string | null = null;
  if (parsed.data.categorySlug) {
    const cat = cats.find((c) => c.slug === parsed.data.categorySlug);
    if (!cat) return { ok: false, error: 'invalid_input' };
    categoryFilterId = cat.id;
    if (daysToPickup < cat.advanceBookMinDays) {
      return {
        ok: false,
        error: 'advance_book_violation',
        details: { minAdvanceDays: cat.advanceBookMinDays },
      };
    }
  }

  // Types in scope
  const types = await db.select().from(vehicleTypes).orderBy(asc(vehicleTypes.sortOrder));
  const typesInScope = categoryFilterId
    ? types.filter((t) => t.categoryId === categoryFilterId)
    : types;
  const typeIdsInScope = typesInScope.map((t) => t.id);
  if (typeIdsInScope.length === 0) return { ok: true, results: [] };

  // Candidate vehicles
  const candidates = await db
    .select()
    .from(vehicles)
    .where(
      and(
        inArray(vehicles.typeId, typeIdsInScope),
        eq(vehicles.status, 'active'),
        isNull(vehicles.deletedAt),
      ),
    );
  if (candidates.length === 0) return { ok: true, results: [] };

  const candidateIds = candidates.map((v) => v.id);

  // Existing active bookings on these vehicles, future-facing
  const existing = await db
    .select({
      vehicleId: bookings.vehicleId,
      pickupAt: bookings.pickupAt,
      returnAt: bookings.returnAt,
      status: bookings.status,
    })
    .from(bookings)
    .where(and(inArray(bookings.vehicleId, candidateIds), gt(bookings.returnAt, new Date())));

  // Rate cards
  const allRates = await db
    .select()
    .from(vehicleRates)
    .where(inArray(vehicleRates.vehicleId, candidateIds));

  const ratesByVehicle = new Map<string, Rate[]>();
  for (const r of allRates) {
    const arr = ratesByVehicle.get(r.vehicleId) ?? [];
    arr.push({
      rateKind: r.rateKind,
      priceAed: r.priceAed,
      packageHours: r.packageHours,
      packageName: r.packageName,
    });
    ratesByVehicle.set(r.vehicleId, arr);
  }

  const typeById = new Map(types.map((t) => [t.id, t]));
  const catById = new Map(cats.map((c) => [c.id, c]));

  const results: SearchResult[] = [];
  for (const v of candidates) {
    const overlap = hasOverlap(
      existing
        .filter((b) => b.vehicleId === v.id && isActiveBookingStatus(b.status))
        .map((b) => ({
          vehicleId: b.vehicleId,
          pickupAt: b.pickupAt,
          returnAt: b.returnAt,
          status: b.status,
        })),
      { vehicleId: v.id, pickupAt, returnAt },
    );
    if (overlap) continue;

    const rates = ratesByVehicle.get(v.id) ?? [];
    const pick = computeBestRate(rates, pickupAt, returnAt);
    if (!pick) continue;

    const type = typeById.get(v.typeId);
    const cat = type ? catById.get(type.categoryId) : null;
    if (!type || !cat) continue;

    results.push({
      vehicleId: v.id,
      make: v.make,
      model: v.model,
      year: v.year,
      primaryPhotoUrl: v.primaryPhotoUrl,
      seats: v.seats,
      doors: v.doors,
      transmission: v.transmission,
      typeId: v.typeId,
      typeNameEn: type.nameEn,
      typeNameAr: type.nameAr,
      categoryId: cat.id,
      categorySlug: cat.slug,
      pick,
    });
  }

  // Sort cheapest first
  results.sort((a, b) => a.pick.totalAed - b.pick.totalAed);
  return { ok: true, results };
}

const quoteSchema = z.object({
  vehicleId: z.uuid(),
  pickupAt: z.iso.datetime(),
  returnAt: z.iso.datetime(),
  addonIds: z.array(z.uuid()).max(20).default([]),
});

export interface QuoteAddon {
  addonId: string;
  slug: string;
  nameEn: string;
  quantity: number;
  unitPriceAed: number;
  lineTotalAed: number;
}

export interface PriceQuote {
  pick: RatePick;
  subtotalAed: number;
  addonsAed: number;
  depositAed: number;
  totalAed: number;
  addons: QuoteAddon[];
  category: { id: string; slug: string };
}

export type PriceQuoteOutcome =
  | { ok: true; quote: PriceQuote }
  | { ok: false; error: 'vehicle_not_found' | 'no_rate_available' | 'invalid_input' };

export async function priceQuote(input: z.infer<typeof quoteSchema>): Promise<PriceQuoteOutcome> {
  const parsed = quoteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid_input' };

  const [v] = await db
    .select()
    .from(vehicles)
    .where(and(eq(vehicles.id, parsed.data.vehicleId), isNull(vehicles.deletedAt)))
    .limit(1);
  if (!v) return { ok: false, error: 'vehicle_not_found' };

  const [type] = await db.select().from(vehicleTypes).where(eq(vehicleTypes.id, v.typeId)).limit(1);
  if (!type) return { ok: false, error: 'vehicle_not_found' };
  const [cat] = await db
    .select()
    .from(vehicleCategories)
    .where(eq(vehicleCategories.id, type.categoryId))
    .limit(1);
  if (!cat) return { ok: false, error: 'vehicle_not_found' };

  const rates = await db
    .select()
    .from(vehicleRates)
    .where(eq(vehicleRates.vehicleId, v.id));

  const pickupAt = new Date(parsed.data.pickupAt);
  const returnAt = new Date(parsed.data.returnAt);
  const pick = computeBestRate(
    rates.map((r) => ({
      rateKind: r.rateKind,
      priceAed: r.priceAed,
      packageHours: r.packageHours,
      packageName: r.packageName,
    })),
    pickupAt,
    returnAt,
  );
  if (!pick) return { ok: false, error: 'no_rate_available' };

  // Addons
  const addonRows =
    parsed.data.addonIds.length > 0
      ? await db.select().from(addonsTable).where(inArray(addonsTable.id, parsed.data.addonIds))
      : [];
  const addons: QuoteAddon[] = addonRows
    .filter((a) => a.active)
    .map((a) => ({
      addonId: a.id,
      slug: a.slug,
      nameEn: a.nameEn,
      quantity: 1, // Phase-1 simple flat 1-per-addon; UI may extend later
      unitPriceAed: a.priceAed,
      lineTotalAed: a.priceAed,
    }));

  const subtotalAed = pick.totalAed;
  const addonsAed = addons.reduce((sum, a) => sum + a.lineTotalAed, 0);
  const depositAed = cat.defaultDepositAed;
  const totalAed = subtotalAed + addonsAed;

  return {
    ok: true,
    quote: {
      pick,
      subtotalAed,
      addonsAed,
      depositAed,
      totalAed,
      addons,
      category: { id: cat.id, slug: cat.slug },
    },
  };
}
