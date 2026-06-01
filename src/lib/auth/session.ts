import { randomBytes, createHash } from 'node:crypto';
import { eq, gt, and } from 'drizzle-orm';
import { sessions, type Session } from '@/db/schema';
import type { Database } from '@/db';

const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export interface CreateSessionInput {
  userId: string;
  userAgent?: string;
  ip?: string;
}

export interface CreateSessionResult {
  token: string;
  expiresAt: Date;
  sessionId: string;
}

export async function createSession(
  db: Database,
  input: CreateSessionInput,
): Promise<CreateSessionResult> {
  const token = generateToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  const [row] = await db
    .insert(sessions)
    .values({
      userId: input.userId,
      tokenHash,
      expiresAt,
      userAgent: input.userAgent ?? null,
      ip: input.ip ?? null,
    })
    .returning({ id: sessions.id });
  if (!row) throw new Error('Failed to create session');
  return { token, expiresAt, sessionId: row.id };
}

export async function readSession(db: Database, token: string): Promise<Session | null> {
  const tokenHash = hashToken(token);
  const rows = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, new Date())))
    .limit(1);
  return rows[0] ?? null;
}

export async function destroySession(db: Database, token: string): Promise<void> {
  const tokenHash = hashToken(token);
  await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
}

export async function destroyAllSessionsForUser(db: Database, userId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}
