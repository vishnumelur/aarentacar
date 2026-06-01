import { NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { pushSubscriptions } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/get-current-user';

const bodySchema = z.object({
  endpoint: z.string().min(20).max(2000),
  keys: z.object({
    p256dh: z.string().min(10).max(500),
    auth: z.string().min(10).max(500),
  }),
});

export async function POST(req: Request): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  let parsed;
  try {
    parsed = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 });
  }

  const userAgent = req.headers.get('user-agent');

  // Upsert by endpoint: if same endpoint comes from a different user, take it over
  const existing = await db
    .select({ id: pushSubscriptions.id })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.endpoint, parsed.endpoint))
    .limit(1);
  if (existing.length > 0) {
    await db
      .update(pushSubscriptions)
      .set({
        userId: user.id,
        p256dh: parsed.keys.p256dh,
        auth: parsed.keys.auth,
        userAgent: userAgent,
        lastUsedAt: new Date(),
      })
      .where(eq(pushSubscriptions.id, existing[0]!.id));
  } else {
    await db.insert(pushSubscriptions).values({
      userId: user.id,
      endpoint: parsed.endpoint,
      p256dh: parsed.keys.p256dh,
      auth: parsed.keys.auth,
      userAgent,
    });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const { endpoint } = (await req.json()) as { endpoint?: string };
  if (!endpoint) return NextResponse.json({ error: 'invalid_input' }, { status: 400 });

  await db
    .delete(pushSubscriptions)
    .where(eq(pushSubscriptions.endpoint, endpoint));
  return NextResponse.json({ ok: true });
}
