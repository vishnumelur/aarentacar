import { describe, it, expect, beforeEach } from 'vitest';
import { sql } from 'drizzle-orm';
import { testDb } from '../../helpers/db';
import { users, vehicleCategories, vehicleTypes, vehicles, bookings } from '@/db/schema';
import { nextBookingCode } from '@/lib/bookings/code';

async function clearDomain(): Promise<void> {
  await testDb.execute(
    sql`TRUNCATE payments, payment_holds, refunds, webhook_events, booking_events, bookings, vehicles, vehicle_types, vehicle_categories, users RESTART IDENTITY CASCADE`,
  );
}

async function seedVehicleAndCustomer() {
  const stamp = Date.now();
  const [user] = await testDb
    .insert(users)
    .values({ email: `cust-${stamp}@test.com`, passwordHash: 'x', fullName: 'C', role: 'customer' })
    .returning({ id: users.id });
  const [cat] = await testDb
    .insert(vehicleCategories)
    .values({ slug: `car-${stamp}`, nameEn: 'Car', nameAr: 'سيارة' })
    .returning({ id: vehicleCategories.id });
  const [type] = await testDb
    .insert(vehicleTypes)
    .values({ categoryId: cat!.id, slug: `sedan-${stamp}`, nameEn: 'Sedan', nameAr: 'س' })
    .returning({ id: vehicleTypes.id });
  const [veh] = await testDb
    .insert(vehicles)
    .values({ typeId: type!.id, make: 'T', model: 'C', year: 2024, plate: `P-${stamp}` })
    .returning({ id: vehicles.id });
  return { customerId: user!.id, vehicleId: veh!.id };
}

async function placeBooking(customerId: string, vehicleId: string): Promise<string> {
  return testDb.transaction(async (tx) => {
    const code = await nextBookingCode(tx);
    await tx.insert(bookings).values({
      code,
      customerId,
      vehicleId,
      rentalKind: 'self_drive',
      pickupAt: new Date('2026-07-01T10:00:00Z'),
      returnAt: new Date('2026-07-03T10:00:00Z'),
      pickupAddress: 'Dubai',
      status: 'pending_payment',
      subtotalAed: 100,
      depositAed: 100,
      totalAed: 100,
    });
    return code;
  });
}

describe('nextBookingCode (real SQL)', () => {
  beforeEach(() => clearDomain());

  it('returns the first code for an empty year', async () => {
    const code = await testDb.transaction((tx) => nextBookingCode(tx));
    const year = new Date().getFullYear();
    expect(code).toBe(`AA-${year}-00001`);
  });

  it('increments monotonically across inserted bookings (regression: no collision on 2nd insert)', async () => {
    const { customerId, vehicleId } = await seedVehicleAndCustomer();
    const year = new Date().getFullYear();

    const first = await placeBooking(customerId, vehicleId);
    expect(first).toBe(`AA-${year}-00001`);

    // Before the fix, SUBSTRING(code FROM $1) resolved to the regex form and
    // returned NULL, so this produced AA-YYYY-00001 again and the insert threw
    // a unique-constraint violation. It must now be AA-YYYY-00002.
    const second = await placeBooking(customerId, vehicleId);
    expect(second).toBe(`AA-${year}-00002`);

    const third = await placeBooking(customerId, vehicleId);
    expect(third).toBe(`AA-${year}-00003`);
  });
});
