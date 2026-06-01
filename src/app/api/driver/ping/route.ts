import { NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { driverProfiles, driverPings } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/get-current-user';

const bodySchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  heading: z.number().min(0).max(360).optional(),
  speed: z.number().min(0).max(200).optional(), // m/s, ~720 km/h cap
  bookingId: z.uuid().optional(),
});

export async function POST(req: Request): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user || user.role !== 'driver') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let parsed;
  try {
    parsed = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 });
  }

  const [profile] = await db
    .select({ userId: driverProfiles.userId })
    .from(driverProfiles)
    .where(eq(driverProfiles.userId, user.id))
    .limit(1);
  if (!profile) {
    return NextResponse.json({ error: 'no_profile' }, { status: 409 });
  }

  const now = new Date();

  await Promise.all([
    db
      .update(driverProfiles)
      .set({
        currentLat: parsed.lat,
        currentLng: parsed.lng,
        lastPingAt: now,
        updatedAt: now,
      })
      .where(eq(driverProfiles.userId, user.id)),
    db.insert(driverPings).values({
      driverId: user.id,
      bookingId: parsed.bookingId ?? null,
      lat: parsed.lat,
      lng: parsed.lng,
      heading: parsed.heading ?? null,
      speed: parsed.speed ?? null,
    }),
  ]);

  return NextResponse.json({ ok: true });
}
