import postgres from 'postgres';
import { randomUUID } from 'node:crypto';

const url = process.env.DATABASE_URL ?? 'postgres://aa:aa@localhost:5432/aa_dev';

/**
 * Inserts a verified customer, a fleet vehicle with a daily rate,
 * a driver_profile (status=available, near the pickup), and a booking
 * already in pending_approval state. Returns the booking's code + the
 * driver's user_id so the test can assert against them.
 *
 * Uses raw SQL to avoid pulling in the Drizzle client (which would
 * collide with the Next.js runtime env that Playwright shares).
 */
export interface DispatchFixture {
  bookingCode: string;
  bookingId: string;
  driverUserId: string;
  customerEmail: string;
  vehiclePlate: string;
}

export async function createDispatchFixture(): Promise<DispatchFixture> {
  const sql = postgres(url, { prepare: false });
  try {
    const stamp = Date.now();
    const customerEmail = `dispatch-fixture-${stamp}@test.com`;
    const driverEmail = `dispatch-driver-${stamp}@test.com`;
    const plate = `DXB-DSP-${stamp.toString().slice(-6)}`;
    const bookingCode = `AA-2099-${String(stamp % 100000).padStart(5, '0')}`;

    // Pickup coords: Burj Khalifa
    const PICKUP_LAT = 25.197197;
    const PICKUP_LNG = 55.274376;
    const DRIVER_LAT = 25.2;
    const DRIVER_LNG = 55.28;

    await sql.begin(async (tx) => {
      // 1. Customer (verified)
      const customerId = randomUUID();
      await tx`
        INSERT INTO users (id, email, password_hash, full_name, role, verification_status)
        VALUES (${customerId}, ${customerEmail}, ${'$2a$12$placeholder-not-used'}, ${'Dispatch Test Customer'}, 'customer', 'verified')
      `;
      await tx`
        INSERT INTO customer_profiles (user_id, residency, date_of_birth, nationality)
        VALUES (${customerId}, 'tourist', '1990-01-01', 'United Kingdom')
      `;

      // 2. Driver (available, near pickup)
      const driverId = randomUUID();
      await tx`
        INSERT INTO users (id, email, password_hash, full_name, role, verification_status)
        VALUES (${driverId}, ${driverEmail}, ${'$2a$12$placeholder-not-used'}, ${'Dispatch Test Driver'}, 'driver', 'verified')
      `;
      await tx`
        INSERT INTO driver_profiles (user_id, license_no, license_expiry, status, current_lat, current_lng, last_ping_at)
        VALUES (${driverId}, ${'DL-' + stamp}, '2030-01-01', 'available', ${DRIVER_LAT}, ${DRIVER_LNG}, now())
      `;

      // 3. Vehicle - find any active vehicle type to attach to
      const types = await tx`SELECT id FROM vehicle_types ORDER BY sort_order LIMIT 1`;
      if (types.length === 0) {
        throw new Error('No vehicle types found - run pnpm db:seed-inventory first');
      }
      const typeId = types[0]!.id;
      const vehicleId = randomUUID();
      await tx`
        INSERT INTO vehicles (id, type_id, make, model, year, plate, color, transmission, seats, doors, fuel_type, status)
        VALUES (${vehicleId}, ${typeId}, 'Fixture', 'TestVehicle', 2024, ${plate}, 'Black', 'automatic', 5, 4, 'petrol', 'active')
      `;
      await tx`
        INSERT INTO vehicle_rates (vehicle_id, rate_kind, price_aed)
        VALUES (${vehicleId}, 'daily', 400)
      `;

      // 4. Booking in pending_approval
      const bookingId = randomUUID();
      const pickupAt = new Date(Date.now() + 24 * 3600_000); // +1 day
      const returnAt = new Date(Date.now() + 4 * 24 * 3600_000); // +4 days
      await tx`
        INSERT INTO bookings (
          id, code, customer_id, vehicle_id, rental_kind,
          pickup_at, return_at, pickup_lat, pickup_lng, pickup_address,
          status, subtotal_aed, addons_aed, discount_aed, deposit_aed, total_aed
        )
        VALUES (
          ${bookingId}, ${bookingCode}, ${customerId}, ${vehicleId}, 'self_drive',
          ${pickupAt}, ${returnAt}, ${PICKUP_LAT}, ${PICKUP_LNG}, 'Burj Khalifa, Downtown Dubai',
          'pending_approval', 1200, 0, 0, 1000, 1200
        )
      `;
      await tx`
        INSERT INTO booking_events (booking_id, actor_user_id, kind, payload)
        VALUES (${bookingId}, ${customerId}, 'created', ${'{"fixture":true}'})
      `;

      // 5. Stash IDs in a global return — we use closure since tx returns void
      (createDispatchFixture as unknown as { _result: DispatchFixture })._result = {
        bookingCode,
        bookingId,
        driverUserId: driverId,
        customerEmail,
        vehiclePlate: plate,
      };
    });

    return (createDispatchFixture as unknown as { _result: DispatchFixture })._result;
  } finally {
    await sql.end({ timeout: 1 });
  }
}
