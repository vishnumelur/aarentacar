import { cookies } from 'next/headers';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { users, type User } from '@/db/schema';
import { readSession } from './session';
import { SESSION_COOKIE_NAME } from './cookies';

export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await readSession(db, token);
  if (!session) return null;

  const rows = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
  return rows[0] ?? null;
}
