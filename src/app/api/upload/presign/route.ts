import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { canAccessPortal } from '@/lib/auth/roles';
import {
  presignVehiclePhotoUpload,
  isAllowedPhotoContentType,
  presignCustomerDocumentUpload,
  isAllowedDocumentContentType,
} from '@/lib/storage/presign';

const bodySchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('vehicle_photo'),
    vehicleId: z.uuid(),
    mimeType: z.string(),
  }),
  z.object({
    kind: z.literal('customer_document'),
    mimeType: z.string(),
  }),
]);

export async function POST(req: Request): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let parsed;
  try {
    parsed = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 });
  }

  if (parsed.kind === 'vehicle_photo') {
    if (!canAccessPortal(user.role, 'manager')) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    if (!isAllowedPhotoContentType(parsed.mimeType)) {
      return NextResponse.json({ error: 'unsupported_mime' }, { status: 415 });
    }
    const r = await presignVehiclePhotoUpload({
      vehicleId: parsed.vehicleId,
      mimeType: parsed.mimeType,
    });
    return NextResponse.json(r);
  }

  // customer_document — any authenticated user uploads their own docs
  if (!isAllowedDocumentContentType(parsed.mimeType)) {
    return NextResponse.json({ error: 'unsupported_mime' }, { status: 415 });
  }
  const r = await presignCustomerDocumentUpload({
    userId: user.id,
    mimeType: parsed.mimeType,
  });
  return NextResponse.json(r);
}
