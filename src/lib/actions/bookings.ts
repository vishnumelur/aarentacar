'use server';

import { z } from 'zod';
import { and, asc, desc, eq, gt, inArray, isNull, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import {
  vehicles,
  vehicleTypes,
  vehicleCategories,
  vehicleRates,
  bookings,
  bookingAddons,
  bookingEvents,
  addons as addonsTable,
  customerProfiles,
  customerDocuments,
  promoCodes,
} from '@/db/schema';
import { hasOverlap, isActiveBookingStatus } from '@/lib/pricing/availability';
import { computeBestRate, type Rate, type RatePick } from '@/lib/pricing/compute-rate';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { nextBookingCode } from '@/lib/bookings/code';
import { validateAndApplyPromo, type PromoApplyError } from '@/lib/promos/apply';
import { enqueueEmailSafe } from '@/lib/mail/send';

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
  promoCode: z.string().trim().min(1).max(40).optional(),
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
  discountAed: number;
  appliedPromoCode: string | null;
  promoError: PromoApplyError | null;
  depositAed: number;
  totalAed: number;
  addons: QuoteAddon[];
  category: { id: string; slug: string };
}

export type PriceQuoteOutcome =
  | { ok: true; quote: PriceQuote }
  | { ok: false; error: 'vehicle_not_found' | 'no_rate_available' | 'invalid_input' };

/**
 * Look up + validate a promo code against a subtotal/category. Pure-helper
 * driven; returns the discount and (on failure) an error reason so the quote
 * UI can show why a code didn't apply without blocking the quote.
 */
async function resolvePromo(
  code: string | undefined,
  subtotalAed: number,
  categoryId: string,
  now: Date,
): Promise<{ discountAed: number; appliedPromoCode: string | null; promoError: PromoApplyError | null }> {
  if (!code) return { discountAed: 0, appliedPromoCode: null, promoError: null };
  const normalized = code.trim().toUpperCase();
  const [row] = await db
    .select()
    .from(promoCodes)
    .where(eq(promoCodes.code, normalized))
    .limit(1);
  const result = validateAndApplyPromo(row ?? null, { subtotalAed, categoryId, now });
  if (!result.ok) {
    return { discountAed: 0, appliedPromoCode: null, promoError: result.error };
  }
  return { discountAed: result.discountAed, appliedPromoCode: result.code, promoError: null };
}

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
  const { discountAed, appliedPromoCode, promoError } = await resolvePromo(
    parsed.data.promoCode,
    subtotalAed,
    cat.id,
    new Date(),
  );
  const totalAed = Math.max(0, subtotalAed + addonsAed - discountAed);

  return {
    ok: true,
    quote: {
      pick,
      subtotalAed,
      addonsAed,
      discountAed,
      appliedPromoCode,
      promoError,
      depositAed,
      totalAed,
      addons,
      category: { id: cat.id, slug: cat.slug },
    },
  };
}

// --- createBooking ----------------------------------------------------------

const createBookingSchema = z.object({
  vehicleId: z.uuid(),
  pickupAt: z.iso.datetime(),
  returnAt: z.iso.datetime(),
  rentalKind: z.enum(['self_drive', 'chauffeur']),
  addonIds: z.array(z.uuid()).max(20).default([]),
  pickupAddress: z.string().min(2).max(500),
  promoCode: z.string().trim().min(1).max(40).optional(),
});

export type CreateBookingOutcome =
  | { ok: true; code: string }
  | {
      ok: false;
      error:
        | 'forbidden'
        | 'invalid_input'
        | 'maintenance_mode'
        | 'profile_required'
        | 'kyc_required'
        | 'driver_under_age'
        | 'license_required'
        | 'license_expired_during_rental'
        | 'advance_book_violation'
        | 'vehicle_taken'
        | 'vehicle_not_found'
        | 'no_rate_available';
      details?: { minAdvanceDays?: number; minDriverAge?: number };
    };

export async function createBooking(
  input: z.infer<typeof createBookingSchema>,
): Promise<CreateBookingOutcome> {
  const user = await getCurrentUser();
  if (!user || user.role !== 'customer') return { ok: false, error: 'forbidden' };
  if (user.verificationStatus !== 'verified') return { ok: false, error: 'kyc_required' };

  // Maintenance mode (Plan #11 feature flag) blocks new bookings.
  const { isFeatureEnabled } = await import('@/lib/feature-flags');
  if (await isFeatureEnabled('maintenance-mode')) {
    return { ok: false, error: 'maintenance_mode' };
  }

  const parsed = createBookingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid_input' };

  const pickupAt = new Date(parsed.data.pickupAt);
  const returnAt = new Date(parsed.data.returnAt);
  if (returnAt <= pickupAt) return { ok: false, error: 'invalid_input' };

  const result = await db.transaction(async (tx) => {
    // Vehicle + type + category
    const [v] = await tx
      .select()
      .from(vehicles)
      .where(and(eq(vehicles.id, parsed.data.vehicleId), isNull(vehicles.deletedAt)))
      .limit(1);
    if (!v) return { ok: false as const, error: 'vehicle_not_found' };

    const [type] = await tx.select().from(vehicleTypes).where(eq(vehicleTypes.id, v.typeId)).limit(1);
    if (!type) return { ok: false as const, error: 'vehicle_not_found' };
    const [cat] = await tx
      .select()
      .from(vehicleCategories)
      .where(eq(vehicleCategories.id, type.categoryId))
      .limit(1);
    if (!cat) return { ok: false as const, error: 'vehicle_not_found' };

    // Advance-book rule
    const daysToPickup = (pickupAt.getTime() - Date.now()) / 86_400_000;
    if (daysToPickup < cat.advanceBookMinDays) {
      return {
        ok: false as const,
        error: 'advance_book_violation',
        details: { minAdvanceDays: cat.advanceBookMinDays },
      };
    }

    // Customer profile required
    const [profile] = await tx
      .select()
      .from(customerProfiles)
      .where(eq(customerProfiles.userId, user.id))
      .limit(1);
    if (!profile) return { ok: false as const, error: 'profile_required' };

    // Min driver age (Plan #14 §A.4)
    const ageYears =
      (pickupAt.getTime() - new Date(profile.dateOfBirth).getTime()) /
      (365.25 * 86_400_000);
    if (ageYears < cat.minDriverAge) {
      return {
        ok: false as const,
        error: 'driver_under_age',
        details: { minDriverAge: cat.minDriverAge },
      };
    }

    // License validity (Plan #14 §A.5): most recent approved driving license front
    if (parsed.data.rentalKind === 'self_drive') {
      const license = await tx
        .select()
        .from(customerDocuments)
        .where(
          and(
            eq(customerDocuments.customerId, user.id),
            eq(customerDocuments.type, 'driving_license_front'),
            eq(customerDocuments.status, 'approved'),
          ),
        )
        .orderBy(desc(customerDocuments.reviewedAt))
        .limit(1);
      const lic = license[0];
      if (!lic) return { ok: false as const, error: 'license_required' };
      if (lic.expiryDate) {
        const expiryStr = lic.expiryDate;
        const returnDateStr = returnAt.toISOString().slice(0, 10);
        if (expiryStr < returnDateStr) {
          return { ok: false as const, error: 'license_expired_during_rental' };
        }
      }
    }

    // Re-check overlap atomically
    const existing = await tx
      .select({
        vehicleId: bookings.vehicleId,
        pickupAt: bookings.pickupAt,
        returnAt: bookings.returnAt,
        status: bookings.status,
      })
      .from(bookings)
      .where(and(eq(bookings.vehicleId, v.id), gt(bookings.returnAt, new Date())));
    if (
      hasOverlap(
        existing
          .filter((b) => isActiveBookingStatus(b.status))
          .map((b) => ({
            vehicleId: b.vehicleId,
            pickupAt: b.pickupAt,
            returnAt: b.returnAt,
            status: b.status,
          })),
        { vehicleId: v.id, pickupAt, returnAt },
      )
    ) {
      return { ok: false as const, error: 'vehicle_taken' };
    }

    // Re-quote pricing server-side (don't trust client totals)
    const ratesRows = await tx
      .select()
      .from(vehicleRates)
      .where(eq(vehicleRates.vehicleId, v.id));
    const pick = computeBestRate(
      ratesRows.map((r) => ({
        rateKind: r.rateKind,
        priceAed: r.priceAed,
        packageHours: r.packageHours,
        packageName: r.packageName,
      })),
      pickupAt,
      returnAt,
    );
    if (!pick) return { ok: false as const, error: 'no_rate_available' };

    // Addons
    const addonRows =
      parsed.data.addonIds.length > 0
        ? await tx.select().from(addonsTable).where(inArray(addonsTable.id, parsed.data.addonIds))
        : [];
    const validAddons = addonRows.filter((a) => a.active);
    const addonsAed = validAddons.reduce((s, a) => s + a.priceAed, 0);

    const subtotalAed = pick.totalAed;
    const depositAed = cat.defaultDepositAed;

    // Promo: validate against the live row, then atomically reserve a use.
    // The conditional UPDATE guards against races (active flips off /
    // max_uses reached between validate and reserve); if zero rows are
    // updated, we silently drop the discount.
    let discountAed = 0;
    let appliedPromoCode: string | null = null;
    if (parsed.data.promoCode) {
      const normalized = parsed.data.promoCode.trim().toUpperCase();
      const [promo] = await tx
        .select()
        .from(promoCodes)
        .where(eq(promoCodes.code, normalized))
        .limit(1);
      const result = validateAndApplyPromo(promo ?? null, {
        subtotalAed,
        categoryId: cat.id,
        now: new Date(),
      });
      if (result.ok) {
        const reserved = await tx
          .update(promoCodes)
          .set({ usedCount: sql`${promoCodes.usedCount} + 1` })
          .where(
            and(
              eq(promoCodes.code, normalized),
              eq(promoCodes.active, true),
              sql`(${promoCodes.maxUses} IS NULL OR ${promoCodes.usedCount} < ${promoCodes.maxUses})`,
            ),
          )
          .returning({ id: promoCodes.id });
        if (reserved.length > 0) {
          discountAed = result.discountAed;
          appliedPromoCode = result.code;
        }
      }
    }

    const totalAed = Math.max(0, subtotalAed + addonsAed - discountAed);

    const code = await nextBookingCode(tx);

    const [booking] = await tx
      .insert(bookings)
      .values({
        code,
        customerId: user.id,
        vehicleId: v.id,
        rentalKind: parsed.data.rentalKind,
        pickupAt,
        returnAt,
        pickupAddress: parsed.data.pickupAddress,
        status: 'pending_payment',
        subtotalAed,
        addonsAed,
        discountAed,
        depositAed,
        totalAed,
        appliedPromoCode,
      })
      .returning({ id: bookings.id });
    if (!booking) {
      return { ok: false as const, error: 'invalid_input' };
    }

    if (validAddons.length > 0) {
      await tx.insert(bookingAddons).values(
        validAddons.map((a) => ({
          bookingId: booking.id,
          addonId: a.id,
          quantity: 1,
          unitPriceAed: a.priceAed,
        })),
      );
    }

    await tx.insert(bookingEvents).values({
      bookingId: booking.id,
      actorUserId: user.id,
      kind: 'created',
      payload: { totalAed, rentalKind: parsed.data.rentalKind },
    });

    revalidatePath('/my-bookings');
    revalidatePath('/manager/bookings');
    return { ok: true as const, code, pickupAt, totalAed };
  });

  // Booking confirmation email (Plan #12). Best-effort, off the request path.
  if (result.ok) {
    await enqueueEmailSafe({
      to: user.email,
      templateName: 'booking-confirmed',
      locale: 'en',
      payload: {
        name: user.fullName,
        bookingCode: result.code,
        pickupAt: result.pickupAt.toISOString(),
        totalAed: result.totalAed,
      },
    });
    return { ok: true as const, code: result.code };
  }
  return result as CreateBookingOutcome;
}

