import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/db';
import { destroySession } from '@/lib/auth/session';
import { buildClearSessionCookie, SESSION_COOKIE_NAME } from '@/lib/auth/cookies';
import { env } from '@/lib/env';

export async function POST(): Promise<NextResponse> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    await destroySession(db, token);
  }
  const cookie = buildClearSessionCookie({
    production: env().NODE_ENV === 'production',
    domain: env().SESSION_COOKIE_DOMAIN,
  });
  const response = NextResponse.json({ ok: true });
  response.cookies.set(cookie);
  return response;
}
