import { describe, it, expect, beforeEach } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { testDb, clearAllTables } from '../../helpers/db';
import {
  users,
  vehicleCategories,
  vehicleTypes,
  vehicles,
  bookings,
  payments,
  webhookEvents,
} from '@/db/schema';
import { POST } from '@/app/api/webhooks/stripe/route';

async function clearPaymentsDomain(): Promise<void> {
  await testDb.execute(
    sql`TRUNCATE payments, payment_holds, refunds, webhook_events, booking_events, bookings, vehicles, vehicle_types, vehicle_categories RESTART IDENTITY CASCADE`,
  );
}

interface Seed {
  bookingId: string;
  bookingCode: string;
  intentId: string;
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
      customerId: user!.id,
      vehicleId: veh!.id,
      rentalKind: 'self_drive',
      pickupAt: new Date(Date.now() + 86_400_000),
      returnAt: new Date(Date.now() + 2 * 86_400_000),
      pickupAddress: 'Dubai Marina',
      status: 'pending_payment',
      subtotalAed: 500,
      depositAed: 1000,
      totalAed: 500,
    })
    .returning({ id: bookings.id, code: bookings.code });

  const intentId = `pi_test_${Date.now()}`;
  await testDb.insert(payments).values({
    bookingId: booking!.id,
    method: 'card',
    gatewayRef: intentId,
    amountAed: 500,
    status: 'initiated',
  });

  return { bookingId: booking!.id, bookingCode: booking!.code, intentId };
}

function makeEvent(eventId: string, intentId: string, type: string) {
  return {
    id: eventId,
    type,
    data: { object: { id: intentId } },
  };
}

function makeRequest(payload: unknown): Request {
  return new Request('http://localhost/api/webhooks/stripe', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

describe('POST /api/webhooks/stripe', () => {
  beforeEach(async () => {
    await clearAllTables();
    await clearPaymentsDomain();
    delete process.env.STRIPE_WEBHOOK_SECRET;
  });

  it('payment_intent.succeeded flips booking to pending_approval', async () => {
    const { bookingId, intentId } = await seed();

    const res = await POST(
      makeRequest(makeEvent('evt_1', intentId, 'payment_intent.succeeded')),
    );
    expect(res.status).toBe(200);

    const [booking] = await testDb.select().from(bookings).where(eq(bookings.id, bookingId));
    expect(booking!.status).toBe('pending_approval');

    const [payment] = await testDb.select().from(payments).where(eq(payments.gatewayRef, intentId));
    expect(payment!.status).toBe('succeeded');
    expect(payment!.capturedAt).not.toBeNull();
  });

  it('is idempotent — re-posting the same event id is a no-op', async () => {
    const { bookingId, intentId } = await seed();
    const event = makeEvent('evt_dup', intentId, 'payment_intent.succeeded');

    const first = await POST(makeRequest(event));
    expect(first.status).toBe(200);

    // Simulate the booking having since advanced (manager approved). A duplicate
    // delivery must NOT touch it again.
    await testDb
      .update(bookings)
      .set({ status: 'approved' })
      .where(eq(bookings.id, bookingId));

    const second = await POST(makeRequest(event));
    expect(second.status).toBe(200);

    const [booking] = await testDb.select().from(bookings).where(eq(bookings.id, bookingId));
    expect(booking!.status).toBe('approved'); // unchanged by the dup

    const ledger = await testDb
      .select()
      .from(webhookEvents)
      .where(eq(webhookEvents.id, 'stripe:evt_dup'));
    expect(ledger).toHaveLength(1);
  });

  it('payment_intent.payment_failed marks payment failed, booking stays pending_payment', async () => {
    const { bookingId, intentId } = await seed();

    const res = await POST(
      makeRequest(makeEvent('evt_fail', intentId, 'payment_intent.payment_failed')),
    );
    expect(res.status).toBe(200);

    const [booking] = await testDb.select().from(bookings).where(eq(bookings.id, bookingId));
    expect(booking!.status).toBe('pending_payment');

    const [payment] = await testDb.select().from(payments).where(eq(payments.gatewayRef, intentId));
    expect(payment!.status).toBe('failed');
  });

  it('rejects an event with no id', async () => {
    const res = await POST(makeRequest({ type: 'payment_intent.succeeded', data: { object: {} } }));
    expect(res.status).toBe(400);
  });
});
