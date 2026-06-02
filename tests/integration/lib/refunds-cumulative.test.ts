import { describe, it, expect, beforeEach, vi } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { testDb } from '../../helpers/db';
import {
  users,
  vehicleCategories,
  vehicleTypes,
  vehicles,
  bookings,
  payments,
  refunds,
} from '@/db/schema';
import type { User } from '@/db/schema';
import * as getUser from '@/lib/auth/get-current-user';
import * as stripeProvider from '@/lib/payments/stripe';
import { issueRefund } from '@/lib/actions/refunds';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

async function clearDomain(): Promise<void> {
  await testDb.execute(
    sql`TRUNCATE payments, refunds, booking_events, bookings, vehicles, vehicle_types, vehicle_categories, audit_logs, sessions, users RESTART IDENTITY CASCADE`,
  );
}

async function seed(): Promise<{ bookingId: string; paymentId: string; manager: User }> {
  const [manager] = await testDb
    .insert(users)
    .values({ email: `mgr-${Date.now()}@test.com`, passwordHash: 'x', fullName: 'Mgr', role: 'manager' })
    .returning();
  const [cust] = await testDb
    .insert(users)
    .values({ email: `cust-${Date.now()}@test.com`, passwordHash: 'x', fullName: 'Cust', role: 'customer' })
    .returning({ id: users.id });
  const [cat] = await testDb
    .insert(vehicleCategories)
    .values({ slug: `car-${Date.now()}`, nameEn: 'Car', nameAr: 'سيارة' })
    .returning({ id: vehicleCategories.id });
  const [type] = await testDb
    .insert(vehicleTypes)
    .values({ categoryId: cat!.id, slug: `sedan-${Date.now()}`, nameEn: 'Sedan', nameAr: 'سيدان' })
    .returning({ id: vehicleTypes.id });
  const [veh] = await testDb
    .insert(vehicles)
    .values({ typeId: type!.id, make: 'Toyota', model: 'Camry', year: 2024, plate: `P-${Date.now()}` })
    .returning({ id: vehicles.id });
  const [booking] = await testDb
    .insert(bookings)
    .values({
      code: `B-${Date.now()}`,
      customerId: cust!.id,
      vehicleId: veh!.id,
      rentalKind: 'self_drive',
      pickupAt: new Date(Date.now() + 86_400_000),
      returnAt: new Date(Date.now() + 2 * 86_400_000),
      pickupAddress: 'Dubai',
      status: 'completed',
      subtotalAed: 500,
      depositAed: 1000,
      totalAed: 500,
    })
    .returning({ id: bookings.id });
  const [payment] = await testDb
    .insert(payments)
    .values({
      bookingId: booking!.id,
      method: 'card',
      gatewayRef: `pi_${Date.now()}`,
      amountAed: 500,
      status: 'succeeded',
    })
    .returning({ id: payments.id });

  return { bookingId: booking!.id, paymentId: payment!.id, manager: manager! };
}

describe('issueRefund cumulative accounting', () => {
  beforeEach(async () => {
    await clearDomain();
    vi.restoreAllMocks();
    // The gateway refund always "succeeds" with a fake id.
    vi.spyOn(stripeProvider, 'refundPayment').mockResolvedValue({ refundId: `re_${Date.now()}` });
  });

  it('rejects a second partial refund that would exceed the original charge', async () => {
    const { bookingId, paymentId, manager } = await seed();
    vi.spyOn(getUser, 'getCurrentUser').mockResolvedValue(manager);

    // First partial refund of 300 of 500 succeeds; payment stays 'succeeded'.
    const first = await issueRefund({ bookingId, amountAed: 300 });
    expect(first.ok).toBe(true);
    const [p1] = await testDb.select().from(payments).where(eq(payments.id, paymentId));
    expect(p1!.status).toBe('succeeded');

    // Second partial of 300 would total 600 > 500 -> rejected.
    const second = await issueRefund({ bookingId, amountAed: 300 });
    expect(second).toEqual({ ok: false, error: 'amount_exceeds_payment' });

    // Only the first refund row exists.
    const rows = await testDb.select().from(refunds).where(eq(refunds.paymentId, paymentId));
    expect(rows).toHaveLength(1);
  });

  it('marks the payment refunded once cumulative refunds reach the full amount', async () => {
    const { bookingId, paymentId, manager } = await seed();
    vi.spyOn(getUser, 'getCurrentUser').mockResolvedValue(manager);

    expect((await issueRefund({ bookingId, amountAed: 200 })).ok).toBe(true);
    const [mid] = await testDb.select().from(payments).where(eq(payments.id, paymentId));
    expect(mid!.status).toBe('succeeded'); // partial, not yet fully refunded

    expect((await issueRefund({ bookingId, amountAed: 300 })).ok).toBe(true);
    const [done] = await testDb.select().from(payments).where(eq(payments.id, paymentId));
    expect(done!.status).toBe('refunded'); // 200 + 300 === 500
  });
});
