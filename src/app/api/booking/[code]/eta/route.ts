import { NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { bookings } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { getEta } from '@/lib/tracking/eta';

export const dynamic = 'force-dynamic';

const latLng = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const bodySchema = z.object({ from: latLng, to: latLng });

export async function POST(
  req: Request,
  ctx: { params: Promise<{ code: string }> },
): Promise<NextResponse> {
  const { code } = await ctx.params;

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const [booking] = await db
    .select({ customerId: bookings.customerId })
    .from(bookings)
    .where(eq(bookings.code, code))
    .limit(1);

  if (!booking) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const isOwner = booking.customerId === user.id;
  const isStaff = user.role === 'manager' || user.role === 'superadmin';
  if (!isOwner && !isStaff) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let parsed;
  try {
    parsed = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 });
  }

  // verify-on-deploy: hits the live Mapbox Directions API when a token is set.
  const eta = await getEta({ from: parsed.from, to: parsed.to });
  if (!eta) {
    return NextResponse.json({ durationSec: null, polyline: [] });
  }

  return NextResponse.json({
    durationSec: eta.durationSec,
    distanceMeters: eta.distanceMeters,
    polyline: eta.polyline,
  });
}
