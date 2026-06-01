import { describe, it, expect, beforeEach, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { clearAllTables, testDb } from '../../helpers/db';
import { users } from '@/db/schema';
import { hashPassword } from '@/lib/auth/password';
import { createSession } from '@/lib/auth/session';
import { SESSION_COOKIE_NAME } from '@/lib/auth/cookies';

async function makeUser(role: 'customer' | 'manager' | 'superadmin') {
  const [u] = await testDb
    .insert(users)
    .values({
      email: `${role}-${Date.now()}-${Math.random()}@t.com`,
      passwordHash: await hashPassword('xxxxxxxxxxx12'),
      fullName: 'T',
      role,
    })
    .returning();
  if (!u) throw new Error('insert failed');
  const { token } = await createSession(testDb, { userId: u.id });
  return { user: u, token };
}

function req(body: unknown, token?: string) {
  const h = new Headers({ 'content-type': 'application/json' });
  return new Request('http://localhost/x', {
    method: 'POST',
    headers: h,
    body: JSON.stringify(body),
  });
}

describe('POST /api/upload/presign', () => {
  beforeEach(async () => {
    await clearAllTables();
    vi.resetModules();
  });

  it('rejects unauthenticated requests with 403', async () => {
    vi.doMock('next/headers', () => ({
      cookies: async () => ({ get: () => undefined }),
    }));
    const { POST } = await import('@/app/api/upload/presign/route');
    const res = await POST(
      req({ kind: 'vehicle_photo', vehicleId: randomUUID(), mimeType: 'image/jpeg' }),
    );
    expect(res.status).toBe(403);
  });

  it('rejects customer role with 403', async () => {
    const { token } = await makeUser('customer');
    vi.doMock('next/headers', () => ({
      cookies: async () => ({ get: (n: string) => (n === SESSION_COOKIE_NAME ? { value: token } : undefined) }),
    }));
    const { POST } = await import('@/app/api/upload/presign/route');
    const res = await POST(
      req({ kind: 'vehicle_photo', vehicleId: randomUUID(), mimeType: 'image/jpeg' }),
    );
    expect(res.status).toBe(403);
  });

  it('rejects unsupported mime with 415', async () => {
    const { token } = await makeUser('manager');
    vi.doMock('next/headers', () => ({
      cookies: async () => ({ get: (n: string) => (n === SESSION_COOKIE_NAME ? { value: token } : undefined) }),
    }));
    const { POST } = await import('@/app/api/upload/presign/route');
    const res = await POST(
      req({ kind: 'vehicle_photo', vehicleId: randomUUID(), mimeType: 'image/gif' }),
    );
    expect(res.status).toBe(415);
  });

  it('returns a presigned URL for a manager', async () => {
    const { token } = await makeUser('manager');
    vi.doMock('next/headers', () => ({
      cookies: async () => ({ get: (n: string) => (n === SESSION_COOKIE_NAME ? { value: token } : undefined) }),
    }));
    const { POST } = await import('@/app/api/upload/presign/route');
    const res = await POST(
      req({ kind: 'vehicle_photo', vehicleId: randomUUID(), mimeType: 'image/jpeg' }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { url: string; key: string };
    expect(body.url).toMatch(/^http:\/\//);
    expect(body.key).toMatch(/^vehicles\//);
  });
});
