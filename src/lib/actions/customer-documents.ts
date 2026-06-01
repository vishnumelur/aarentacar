'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { and, eq, ne } from 'drizzle-orm';
import { db } from '@/db';
import { customerDocuments, users } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/get-current-user';

const submitSchema = z.object({
  type: z.enum([
    'passport',
    'visa',
    'emirates_id_front',
    'emirates_id_back',
    'driving_license_front',
    'driving_license_back',
    'international_permit',
  ]),
  fileKey: z.string().min(1).max(500),
  expiryDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export async function submitDocument(input: z.infer<typeof submitSchema>) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'customer') {
    return { ok: false as const, error: 'forbidden' };
  }
  const parsed = submitSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: 'invalid_input' };

  // Withdraw any existing pending/approved doc of the same type
  await db
    .update(customerDocuments)
    .set({ status: 'withdrawn' })
    .where(
      and(
        eq(customerDocuments.customerId, user.id),
        eq(customerDocuments.type, parsed.data.type),
        ne(customerDocuments.status, 'rejected'),
        ne(customerDocuments.status, 'expired'),
        ne(customerDocuments.status, 'withdrawn'),
      ),
    );

  await db.insert(customerDocuments).values({
    customerId: user.id,
    type: parsed.data.type,
    fileUrl: parsed.data.fileKey,
    expiryDate: parsed.data.expiryDate ?? null,
    status: 'pending',
  });

  // Flip user.verification_status to pending so manager review queue picks them up
  await db
    .update(users)
    .set({ verificationStatus: 'pending', updatedAt: new Date() })
    .where(eq(users.id, user.id));

  revalidatePath('/verification');
  return { ok: true as const };
}

export async function withdrawDocument(input: { documentId: string }) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'customer') {
    return { ok: false as const, error: 'forbidden' };
  }
  const [doc] = await db
    .select()
    .from(customerDocuments)
    .where(eq(customerDocuments.id, input.documentId))
    .limit(1);
  if (!doc || doc.customerId !== user.id) {
    return { ok: false as const, error: 'not_found' };
  }
  await db
    .update(customerDocuments)
    .set({ status: 'withdrawn' })
    .where(eq(customerDocuments.id, doc.id));
  revalidatePath('/verification');
  return { ok: true as const };
}
