import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { canAccessPortal } from '@/lib/auth/roles';
import { presignVehiclePhotoUpload, isAllowedPhotoContentType } from '@/lib/storage/presign';

const bodySchema = z.object({
  kind: z.literal('vehicle_photo'),
  vehicleId: z.uuid(),
  mimeType: z.string(),
});

export async function POST(req: Request): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user || !canAccessPortal(user.role, 'manager')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let parsed;
  try {
    parsed = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 });
  }

  if (!isAllowedPhotoContentType(parsed.mimeType)) {
    return NextResponse.json({ error: 'unsupported_mime' }, { status: 415 });
  }

  const { url, key, expiresInSec } = await presignVehiclePhotoUpload({
    vehicleId: parsed.vehicleId,
    mimeType: parsed.mimeType,
  });
  return NextResponse.json({ url, key, expiresInSec });
}
