import { NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';
import { hashPassword } from '@/lib/auth/password';
import { createSession } from '@/lib/auth/session';
import { buildSessionCookie } from '@/lib/auth/cookies';
import { env } from '@/lib/env';

const bodySchema = z.object({
  email: z.email().transform((s) => s.toLowerCase().trim()),
  password: z.string().min(12).max(128),
  fullName: z.string().min(1).max(120).transform((s) => s.trim()),
  phone: z.string().min(7).max(20).optional(),
  preferredLanguage: z.enum(['en', 'ar']).default('en'),
});

export async function POST(req: Request): Promise<NextResponse> {
  let parsed;
  try {
    parsed = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 });
  }

  const existing = await db.select().from(users).where(eq(users.email, parsed.email)).limit(1);
  if (existing.length > 0) {
    return NextResponse.json({ error: 'email_taken' }, { status: 409 });
  }

  const passwordHash = await hashPassword(parsed.password);
  const [user] = await db
    .insert(users)
    .values({
      email: parsed.email,
      passwordHash,
      fullName: parsed.fullName,
      phone: parsed.phone ?? null,
      preferredLanguage: parsed.preferredLanguage,
      role: 'customer',
    })
    .returning();
  if (!user) {
    return NextResponse.json({ error: 'insert_failed' }, { status: 500 });
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

  const response = NextResponse.json(
    {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        preferredLanguage: user.preferredLanguage,
      },
    },
    { status: 201 },
  );
  response.cookies.set(cookie);
  return response;
}
