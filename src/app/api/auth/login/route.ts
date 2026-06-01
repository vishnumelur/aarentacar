import { NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';
import { verifyPassword } from '@/lib/auth/password';
import { createSession } from '@/lib/auth/session';
import { buildSessionCookie } from '@/lib/auth/cookies';
import { env } from '@/lib/env';

const bodySchema = z.object({
  email: z.email().transform((s) => s.toLowerCase().trim()),
  password: z.string().min(1).max(128),
});

export async function POST(req: Request): Promise<NextResponse> {
  let parsed;
  try {
    parsed = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 });
  }

  const rows = await db.select().from(users).where(eq(users.email, parsed.email)).limit(1);
  const user = rows[0];
  if (!user || !(await verifyPassword(parsed.password, user.passwordHash))) {
    return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 });
  }

  const { token, expiresAt } = await createSession(db, {
    userId: user.id,
    userAgent: req.headers.get('user-agent') ?? undefined,
    ip: req.headers.get('x-forwarded-for') ?? undefined,
  });

  const cookie = buildSessionCookie({
    token,
    expiresAt,
    production: env().NODE_ENV === 'production',
    domain: env().SESSION_COOKIE_DOMAIN,
  });

  const response = NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      preferredLanguage: user.preferredLanguage,
    },
  });
  response.cookies.set(cookie);
  return response;
}
