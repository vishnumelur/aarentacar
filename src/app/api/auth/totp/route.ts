import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { users, auditLogs } from '@/db/schema';
import { createSession } from '@/lib/auth/session';
import { buildSessionCookie } from '@/lib/auth/cookies';
import {
  TOTP_PENDING_COOKIE_NAME,
  verifyTotpPending,
} from '@/lib/auth/totp-pending';
import { verifyLoginCode, consumeRecoveryCode } from '@/lib/totp/store';
import { env } from '@/lib/env';

const bodySchema = z.object({
  code: z.string().min(1).max(20),
});

export async function POST(req: Request): Promise<NextResponse> {
  let parsed;
  try {
    parsed = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 });
  }

  const store = await cookies();
  const pending = store.get(TOTP_PENDING_COOKIE_NAME)?.value;
  const userId = pending ? verifyTotpPending(pending, env().ENCRYPTION_KEY) : null;
  if (!userId) {
    return NextResponse.json({ error: 'no_pending_challenge' }, { status: 401 });
  }

  const code = parsed.code.trim();
  const isRecovery = code.includes('-');
  const ok = isRecovery
    ? await consumeRecoveryCode(userId, code)
    : await verifyLoginCode(userId, code);

  if (!ok) {
    await db.insert(auditLogs).values({
      actorUserId: userId,
      action: 'auth.totp.failed',
      targetType: 'user',
      targetId: userId,
      payload: { recovery: isRecovery },
    });
    return NextResponse.json({ error: 'invalid_code' }, { status: 401 });
  }

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) {
    return NextResponse.json({ error: 'no_pending_challenge' }, { status: 401 });
  }

  const { token, expiresAt } = await createSession(db, {
    userId: user.id,
    userAgent: req.headers.get('user-agent') ?? undefined,
    ip: req.headers.get('x-forwarded-for') ?? undefined,
  });

  await db.insert(auditLogs).values({
    actorUserId: user.id,
    action: 'auth.totp.succeeded',
    targetType: 'user',
    targetId: user.id,
    payload: { recovery: isRecovery },
  });

  const response = NextResponse.json({
    user: { id: user.id, email: user.email, role: user.role },
  });
  response.cookies.set(
    buildSessionCookie({
      token,
      expiresAt,
      production: env().NODE_ENV === 'production',
      domain: env().SESSION_COOKIE_DOMAIN,
    }),
  );
  // Clear the interim pending cookie.
  response.cookies.set({
    name: TOTP_PENDING_COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: env().NODE_ENV === 'production',
    sameSite: 'lax',
    domain: env().SESSION_COOKIE_DOMAIN,
    path: '/',
    expires: new Date(0),
  });
  return response;
}
