import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { sql } from 'drizzle-orm';
import { testDb, clearAllTables } from '../../helpers/db';
import {
  users,
  vehicleCategories,
  vehicleTypes,
  vehicles,
  bookings,
  driverProfiles,
  bookingAssignments,
  driverPings,
} from '@/db/schema';
import { hashPassword } from '@/lib/auth/password';
import { createSession } from '@/lib/auth/session';
import { SESSION_COOKIE_NAME } from '@/lib/auth/cookies';

async function clearDomain(): Promise<void> {
  await testDb.execute(
    sql`TRUNCATE driver_pings, booking_assignments, booking_events, bookings, driver_profiles, vehicles, vehicle_types, vehicle_categories RESTART IDENTITY CASCADE`,
  );
  await clearAllTables();
}

interface Seed {
  code: string;
  customerToken: string;
  otherToken: string;
  driverUserId: string;
}

async function seed(): Promise<Seed> {
  const stamp = `${Date.now()}-${Math.random()}`;

  const [customer] = await testDb
    .insert(users)
    .values({
      email: `cust-${stamp}@t.com`,
      passwordHash: await hashPassword('xxxxxxxxxxx12'),
      fullName: 'Customer',
      role: 'customer',
    })
    .returning({ id: users.id });

  const [other] = await testDb
    .insert(users)
    .values({
      email: `other-${stamp}@t.com`,
      passwordHash: await hashPassword('xxxxxxxxxxx12'),
      fullName: 'Other',
      role: 'customer',
    })
    .returning({ id: users.id });

  const [driver] = await testDb
    .insert(users)
    .values({
      email: `driver-${stamp}@t.com`,
      passwordHash: await hashPassword('xxxxxxxxxxx12'),
      fullName: 'Driver',
      role: 'driver',
    })
    .returning({ id: users.id });

  const [manager] = await testDb
    .insert(users)
    .values({
      email: `mgr-${stamp}@t.com`,
      passwordHash: await hashPassword('xxxxxxxxxxx12'),
      fullName: 'Manager',
      role: 'manager',
    })
    .returning({ id: users.id });

  await testDb.insert(driverProfiles).values({
    userId: driver!.id,
    licenseNo: 'L-1',
    licenseExpiry: '2030-01-01',
  });

  const [cat] = await testDb
    .insert(vehicleCategories)
    .values({ slug: `car-${stamp}`, nameEn: 'Car', nameAr: 'سيارة' })
    .returning({ id: vehicleCategories.id });
  const [type] = await testDb
    .insert(vehicleTypes)
    .values({ categoryId: cat!.id, slug: `sedan-${stamp}`, nameEn: 'Sedan', nameAr: 'سيدان' })
    .returning({ id: vehicleTypes.id });
  const [veh] = await testDb
    .insert(vehicles)
    .values({ typeId: type!.id, make: 'Toyota', model: 'Camry', year: 2024, plate: `P-${stamp}` })
    .returning({ id: vehicles.id });

  const code = `B-${stamp}`;
  const [booking] = await testDb
    .insert(bookings)
    .values({
      code,
      customerId: customer!.id,
      vehicleId: veh!.id,
      rentalKind: 'chauffeur',
      pickupAt: new Date(Date.now() + 86_400_000),
      returnAt: new Date(Date.now() + 2 * 86_400_000),
      pickupAddress: 'Dubai Marina',
      status: 'dispatched',
      subtotalAed: 500,
      depositAed: 1000,
      totalAed: 500,
    })
    .returning({ id: bookings.id });

  await testDb.insert(bookingAssignments).values({
    bookingId: booking!.id,
    driverId: driver!.id,
    assignedByUserId: manager!.id,
    status: 'accepted',
    acceptedAt: new Date(),
  });

  // Three pings, increasing time + moving NE.
  const base = Date.now() - 10_000;
  await testDb.insert(driverPings).values([
    { driverId: driver!.id, bookingId: booking!.id, lat: 25.07, lng: 55.13, heading: 45, recordedAt: new Date(base) },
    { driverId: driver!.id, bookingId: booking!.id, lat: 25.08, lng: 55.14, heading: 46, recordedAt: new Date(base + 2000) },
    { driverId: driver!.id, bookingId: booking!.id, lat: 25.09, lng: 55.15, heading: 47, recordedAt: new Date(base + 4000) },
  ]);

  const { token: customerToken } = await createSession(testDb, { userId: customer!.id });
  const { token: otherToken } = await createSession(testDb, { userId: other!.id });

  return { code, customerToken, otherToken, driverUserId: driver!.id };
}

function mockCookies(token: string | null): void {
  vi.doMock('next/headers', () => ({
    cookies: async () => ({
      get: (n: string) => (token && n === SESSION_COOKIE_NAME ? { value: token } : undefined),
    }),
  }));
}

function trackRequest(code: string, signal: AbortSignal): Request {
  return new Request(`http://localhost/api/booking/${code}/track`, { signal });
}

async function readEvents(res: Response, expected: number, controller: AbortController): Promise<string[]> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  const messages: string[] = [];
  let buffer = '';
  const deadline = Date.now() + 8000;

  while (messages.length < expected && Date.now() < deadline) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() ?? '';
    for (const part of parts) {
      const line = part.split('\n').find((l) => l.startsWith('data: '));
      if (line) messages.push(line.slice('data: '.length));
    }
  }
  controller.abort();
  try {
    await reader.cancel();
  } catch {
    // ignore
  }
  return messages;
}

describe('GET /api/booking/[code]/track (SSE)', () => {
  beforeEach(async () => {
    await clearDomain();
    vi.resetModules();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('rejects unauthenticated requests with 401', async () => {
    const { code } = await seed();
    mockCookies(null);
    const { GET } = await import('@/app/api/booking/[code]/track/route');
    const ac = new AbortController();
    const res = await GET(trackRequest(code, ac.signal), { params: Promise.resolve({ code }) });
    ac.abort();
    expect(res.status).toBe(401);
  });

  it('rejects a non-owning customer with 403', async () => {
    const { code, otherToken } = await seed();
    mockCookies(otherToken);
    const { GET } = await import('@/app/api/booking/[code]/track/route');
    const ac = new AbortController();
    const res = await GET(trackRequest(code, ac.signal), { params: Promise.resolve({ code }) });
    ac.abort();
    expect(res.status).toBe(403);
  });

  it('returns 404 for an unknown booking code', async () => {
    const { customerToken } = await seed();
    mockCookies(customerToken);
    const { GET } = await import('@/app/api/booking/[code]/track/route');
    const ac = new AbortController();
    const res = await GET(trackRequest('NOPE', ac.signal), { params: Promise.resolve({ code: 'NOPE' }) });
    ac.abort();
    expect(res.status).toBe(404);
  });

  it('streams at least 3 ping events in chronological order to the owner', async () => {
    const { code, customerToken } = await seed();
    mockCookies(customerToken);
    const { GET } = await import('@/app/api/booking/[code]/track/route');
    const ac = new AbortController();
    const res = await GET(trackRequest(code, ac.signal), { params: Promise.resolve({ code }) });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');

    const messages = await readEvents(res, 3, ac);
    expect(messages.length).toBeGreaterThanOrEqual(3);

    const parsed = messages.map((m) => JSON.parse(m) as { lat: number; recordedAt: string });
    // Chronological order (initial state emits all pings up to "now").
    for (let i = 1; i < parsed.length; i++) {
      expect(new Date(parsed[i]!.recordedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(parsed[i - 1]!.recordedAt).getTime(),
      );
    }
    // Latitudes increase as the driver moves NE.
    expect(parsed[parsed.length - 1]!.lat).toBeGreaterThan(parsed[0]!.lat);
  });
});
