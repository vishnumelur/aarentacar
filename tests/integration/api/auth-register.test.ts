import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { testDb, clearAllTables } from '../../helpers/db';
import { users } from '@/db/schema';
import { POST } from '@/app/api/auth/register/route';

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'user-agent': 'vitest' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/auth/register', () => {
  beforeEach(() => clearAllTables());

  it('creates a user with hashed password and returns 201', async () => {
    const res = await POST(makeRequest({
      email: 'new@user.com',
      password: 'correct horse battery staple',
      fullName: 'New User',
      phone: '+971500000000',
    }));
    expect(res.status).toBe(201);
    const body = (await res.json()) as { user: { email: string; passwordHash?: string } };
    expect(body.user.email).toBe('new@user.com');
    expect(body.user).not.toHaveProperty('passwordHash');

    const [row] = await testDb.select().from(users).where(eq(users.email, 'new@user.com'));
    expect(row).toBeDefined();
    expect(row!.passwordHash).toMatch(/^\$2[aby]\$/);
  });

  it('returns 400 on invalid input', async () => {
    const res = await POST(makeRequest({ email: 'not-an-email' }));
    expect(res.status).toBe(400);
  });

  it('returns 409 on duplicate email', async () => {
    await POST(makeRequest({
      email: 'dup@user.com',
      password: 'password-1234',
      fullName: 'A',
    }));
    const res = await POST(makeRequest({
      email: 'dup@user.com',
      password: 'password-1234',
      fullName: 'B',
    }));
    expect(res.status).toBe(409);
  });
});
