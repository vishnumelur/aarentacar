import { describe, it, expect, beforeEach } from 'vitest';
import { sql } from 'drizzle-orm';
import { testDb, clearAllTables } from '../../helpers/db';
import {
  users,
  vehicleCategories,
  vehicleTypes,
  vehicles,
  bookings,
  payments,
} from '@/db/schema';
import { revenueByPeriod, topTypesByRevenue } from '@/lib/reports/revenue';
import { occupancyPerVehicle } from '@/lib/reports/occupancy';
import { paymentMix } from '@/lib/reports/payment-mix';
import { toCsv } from '@/lib/reports/csv';

async function clearReportsDomain(): Promise<void> {
  await testDb.execute(
    sql`TRUNCATE payments, payment_holds, refunds, webhook_events, booking_events, bookings, vehicles, vehicle_types, vehicle_categories RESTART IDENTITY CASCADE`,
  );
}

interface Seed {
  vehicleAId: string;
  vehicleBId: string;
  typeSedan: string;
  typeSuv: string;
}

async function seed(): Promise<Seed> {
  const [user] = await testDb
    .insert(users)
    .values({
      email: `cust-${Date.now()}@test.com`,
      passwordHash: 'x',
      fullName: 'Test Customer',
      role: 'customer',
    })
    .returning({ id: users.id });

  const [cat] = await testDb
    .insert(vehicleCategories)
    .values({ slug: `car-${Date.now()}`, nameEn: 'Car', nameAr: 'سيارة' })
    .returning({ id: vehicleCategories.id });

  const [sedan] = await testDb
    .insert(vehicleTypes)
    .values({ categoryId: cat!.id, slug: `sedan-${Date.now()}`, nameEn: 'Sedan', nameAr: 'سيدان' })
    .returning({ id: vehicleTypes.id });
  const [suv] = await testDb
    .insert(vehicleTypes)
    .values({ categoryId: cat!.id, slug: `suv-${Date.now()}`, nameEn: 'SUV', nameAr: 'إس يو في' })
    .returning({ id: vehicleTypes.id });

  const [vehA] = await testDb
    .insert(vehicles)
    .values({ typeId: sedan!.id, make: 'Toyota', model: 'Camry', year: 2024, plate: `PA-${Date.now()}` })
    .returning({ id: vehicles.id });
  const [vehB] = await testDb
    .insert(vehicles)
    .values({ typeId: suv!.id, make: 'Nissan', model: 'Patrol', year: 2024, plate: `PB-${Date.now()}` })
    .returning({ id: vehicles.id });

  // Two bookings on 2026-05-10 (sedan, suv), one on 2026-05-11 (sedan)
  async function mkBooking(
    vehicleId: string,
    createdAt: string,
    totalAed: number,
    status: string,
    pickup: string,
    ret: string,
  ): Promise<string> {
    const [b] = await testDb
      .insert(bookings)
      .values({
        code: `B-${Math.random().toString(36).slice(2, 10)}`,
        customerId: user!.id,
        vehicleId,
        rentalKind: 'self_drive',
        pickupAt: new Date(pickup),
        returnAt: new Date(ret),
        pickupAddress: 'Dubai Marina',
        status: status as never,
        subtotalAed: totalAed,
        depositAed: 1000,
        totalAed,
        createdAt: new Date(createdAt),
      })
      .returning({ id: bookings.id });
    return b!.id;
  }

  const b1 = await mkBooking(
    vehA!.id,
    '2026-05-10T08:00:00Z',
    300,
    'completed',
    '2026-05-10T09:00:00Z',
    '2026-05-12T09:00:00Z', // 2 rented days
  );
  const b2 = await mkBooking(
    vehB!.id,
    '2026-05-10T10:00:00Z',
    700,
    'completed',
    '2026-05-10T10:00:00Z',
    '2026-05-11T10:00:00Z', // 1 rented day
  );
  const b3 = await mkBooking(
    vehA!.id,
    '2026-05-11T08:00:00Z',
    200,
    'cancelled', // cancelled excluded from revenue
    '2026-05-20T09:00:00Z',
    '2026-05-21T09:00:00Z',
  );

  await testDb.insert(payments).values([
    { bookingId: b1, method: 'card', amountAed: 300, status: 'succeeded', createdAt: new Date('2026-05-10T08:05:00Z') },
    { bookingId: b2, method: 'tabby', amountAed: 700, status: 'succeeded', createdAt: new Date('2026-05-10T10:05:00Z') },
    { bookingId: b3, method: 'cod', amountAed: 200, status: 'manual_pending', createdAt: new Date('2026-05-11T08:05:00Z') },
  ]);

  return { vehicleAId: vehA!.id, vehicleBId: vehB!.id, typeSedan: sedan!.id, typeSuv: suv!.id };
}

describe('reports', () => {
  beforeEach(async () => {
    await clearAllTables();
    await clearReportsDomain();
  });

  it('revenueByPeriod sums non-cancelled booking totals per day', async () => {
    await seed();
    const rows = await revenueByPeriod(testDb, {
      granularity: 'day',
      from: new Date('2026-05-01T00:00:00Z'),
      to: new Date('2026-06-01T00:00:00Z'),
    });
    // Only the 2026-05-10 day has revenue (300 + 700); cancelled excluded.
    const total = rows.reduce((s, r) => s + r.revenueAed, 0);
    expect(total).toBe(1000);
    const may10 = rows.find((r) => r.period.startsWith('2026-05-10'));
    expect(may10?.revenueAed).toBe(1000);
    expect(may10?.bookings).toBe(2);
  });

  it('topTypesByRevenue groups by vehicle type sorted desc', async () => {
    await seed();
    const rows = await topTypesByRevenue(testDb, {
      from: new Date('2026-05-01T00:00:00Z'),
      to: new Date('2026-06-01T00:00:00Z'),
    });
    expect(rows[0]?.nameEn).toBe('SUV'); // 700 > 300
    expect(rows[0]?.revenueAed).toBe(700);
    expect(rows[1]?.nameEn).toBe('Sedan');
    expect(rows[1]?.revenueAed).toBe(300);
  });

  it('occupancyPerVehicle counts rented days within the window', async () => {
    await seed();
    const rows = await occupancyPerVehicle(testDb, {
      from: new Date('2026-05-01T00:00:00Z'),
      to: new Date('2026-06-01T00:00:00Z'),
    });
    const byPlate = Object.fromEntries(rows.map((r) => [r.model, r.rentedDays]));
    // Camry: b1 = 2 days (cancelled b3 excluded). Patrol: b2 = 1 day.
    expect(byPlate['Camry']).toBe(2);
    expect(byPlate['Patrol']).toBe(1);
  });

  it('paymentMix counts and sums succeeded payments per method', async () => {
    await seed();
    const rows = await paymentMix(testDb, {
      from: new Date('2026-05-01T00:00:00Z'),
      to: new Date('2026-06-01T00:00:00Z'),
    });
    const byMethod = Object.fromEntries(rows.map((r) => [r.method, r]));
    expect(byMethod['card']!.count).toBe(1);
    expect(byMethod['card']!.amountAed).toBe(300);
    expect(byMethod['tabby']!.amountAed).toBe(700);
    // manual_pending cod is excluded (not succeeded)
    expect(byMethod['cod']).toBeUndefined();
  });

  it('toCsv produces a header row and escapes commas/quotes', () => {
    const csv = toCsv(
      ['period', 'revenueAed'],
      [
        { period: '2026-05-10', revenueAed: 1000 },
        { period: 'a,b "c"', revenueAed: 0 },
      ],
    );
    const lines = csv.split('\n');
    expect(lines[0]).toBe('period,revenueAed');
    expect(lines[1]).toBe('2026-05-10,1000');
    expect(lines[2]).toBe('"a,b ""c""",0');
  });
});
