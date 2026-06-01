'use server';

import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { db } from '@/db';
import {
  bookingAssignments,
  bookings,
  bookingEvents,
  damageInspections,
  agreements,
  customerProfiles,
  users,
  vehicles,
} from '@/db/schema';
import { s3, BUCKETS } from '@/lib/storage/minio';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { renderRentalAgreementPdf } from '@/lib/agreements/render-pdf';

const schema = z.object({
  assignmentId: z.uuid(),
  photos: z.array(z.string().min(5).max(500)).min(1).max(20),
  odometer: z.coerce.number().int().min(0).max(2_000_000),
  fuelLevel: z.coerce.number().int().min(0).max(100),
  damageNotes: z.string().max(2000).optional(),
  signatureKey: z.string().min(5).max(500),
  signatureDataUrl: z.string().startsWith('data:image/png;base64,').max(2_000_000),
});

export type RecordHandoverOutcome =
  | { ok: true; agreementUrl: string }
  | {
      ok: false;
      error:
        | 'forbidden'
        | 'invalid_input'
        | 'not_found'
        | 'invalid_status'
        | 'already_recorded';
    };

export async function recordHandover(
  input: z.infer<typeof schema>,
): Promise<RecordHandoverOutcome> {
  const me = await getCurrentUser();
  if (!me || me.role !== 'driver') return { ok: false, error: 'forbidden' };

  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid_input' };

  // Find the assignment + booking + adjacent rows we need for the PDF
  const [assignment] = await db
    .select()
    .from(bookingAssignments)
    .where(eq(bookingAssignments.id, parsed.data.assignmentId))
    .limit(1);
  if (!assignment) return { ok: false, error: 'not_found' };
  if (assignment.driverId !== me.id) return { ok: false, error: 'forbidden' };
  if (assignment.status !== 'accepted') return { ok: false, error: 'invalid_status' };

  const [booking] = await db
    .select()
    .from(bookings)
    .where(eq(bookings.id, assignment.bookingId))
    .limit(1);
  if (!booking) return { ok: false, error: 'not_found' };
  if (booking.status !== 'dispatched') return { ok: false, error: 'invalid_status' };

  // Reject if there's already a handover inspection for this booking
  const existingInspection = await db
    .select({ id: damageInspections.id })
    .from(damageInspections)
    .where(eq(damageInspections.bookingId, booking.id))
    .limit(1);
  // (Looser check — if any inspection exists for this booking yet, the next stage logic
  //  in Task 9 handles return; for now we just refuse a duplicate handover.)
  if (existingInspection.length > 0) {
    return { ok: false, error: 'already_recorded' };
  }

  const [customer] = await db
    .select()
    .from(users)
    .where(eq(users.id, booking.customerId))
    .limit(1);
  const [profile] = await db
    .select()
    .from(customerProfiles)
    .where(eq(customerProfiles.userId, booking.customerId))
    .limit(1);
  const [vehicle] = await db
    .select()
    .from(vehicles)
    .where(eq(vehicles.id, booking.vehicleId))
    .limit(1);
  if (!customer || !vehicle) return { ok: false, error: 'not_found' };

  // Render PDF
  const pdfBuffer = await renderRentalAgreementPdf({
    bookingCode: booking.code,
    generatedAt: new Date(),
    customer: {
      fullName: customer.fullName,
      email: customer.email,
      phone: customer.phone,
      nationality: profile?.nationality ?? null,
    },
    vehicle: {
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year,
      plate: vehicle.plate,
    },
    rental: {
      kind: booking.rentalKind,
      pickupAt: booking.pickupAt,
      returnAt: booking.returnAt,
      pickupAddress: booking.pickupAddress,
    },
    amounts: {
      subtotalAed: booking.subtotalAed,
      addonsAed: booking.addonsAed,
      depositAed: booking.depositAed,
      totalAed: booking.totalAed,
    },
    signatureDataUrl: parsed.data.signatureDataUrl,
  });

  // Upload PDF to agreements/ bucket
  const pdfKey = `agreements/${booking.id}.pdf`;
  await s3().send(
    new PutObjectCommand({
      Bucket: BUCKETS.agreements,
      Key: pdfKey,
      Body: pdfBuffer,
      ContentType: 'application/pdf',
    }),
  );

  // Write all the DB rows in a transaction
  await db.transaction(async (tx) => {
    await tx.insert(damageInspections).values({
      bookingId: booking.id,
      stage: 'handover',
      photos: parsed.data.photos,
      odometer: parsed.data.odometer,
      fuelLevel: parsed.data.fuelLevel,
      damageNotes: parsed.data.damageNotes ?? null,
      signatureImageUrl: parsed.data.signatureKey,
      signedByCustomerAt: new Date(),
      driverId: me.id,
    });

    await tx.insert(agreements).values({
      bookingId: booking.id,
      pdfUrl: pdfKey,
      customerSignatureImageUrl: parsed.data.signatureKey,
    });

    await tx
      .update(bookings)
      .set({ status: 'in_progress', updatedAt: new Date() })
      .where(eq(bookings.id, booking.id));

    await tx.insert(bookingEvents).values({
      bookingId: booking.id,
      actorUserId: me.id,
      kind: 'handover_completed',
      payload: {
        agreementPdfKey: pdfKey,
        odometer: parsed.data.odometer,
        fuelLevel: parsed.data.fuelLevel,
      },
    });
  });

  revalidatePath('/driver');
  revalidatePath(`/driver/jobs/${parsed.data.assignmentId}`);
  revalidatePath(`/manager/bookings/${booking.code}`);
  revalidatePath(`/my-bookings/${booking.code}`);

  return { ok: true, agreementUrl: pdfKey };
}
