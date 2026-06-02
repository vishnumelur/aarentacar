import postgres from 'postgres';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';

const url = process.env.DATABASE_URL ?? 'postgres://aa:aa@localhost:5432/aa_dev';

export interface SuperadminFixture {
  email: string;
  password: string;
  userId: string;
}

/**
 * Inserts a fresh super-admin with a known password so the credentials e2e
 * can log in without depending on the seeded SUPERADMIN_PASSWORD env value.
 *
 * Uses raw SQL (like dispatch-fixtures) to avoid pulling in the Drizzle client
 * which collides with the Next.js runtime env Playwright shares.
 */
export async function createSuperadminFixture(): Promise<SuperadminFixture> {
  const sql = postgres(url, { prepare: false });
  try {
    const stamp = Date.now();
    const email = `e2e-superadmin-${stamp}@test.com`;
    const password = 'super-admin-e2e-password';
    const passwordHash = await bcrypt.hash(password, 12);
    const userId = randomUUID();
    await sql`
      INSERT INTO users (id, email, password_hash, full_name, role, verification_status)
      VALUES (${userId}, ${email}, ${passwordHash}, 'E2E Super Admin', 'superadmin', 'verified')
    `;
    return { email, password, userId };
  } finally {
    await sql.end({ timeout: 5 });
  }
}

/** Read the most recent credential.set audit row for a given target. */
export async function findCredentialSetAudit(
  targetId: string,
): Promise<{ found: boolean }> {
  const sql = postgres(url, { prepare: false });
  try {
    const rows = await sql`
      SELECT id FROM audit_logs
      WHERE action = 'credential.set' AND target_id = ${targetId}
      ORDER BY created_at DESC
      LIMIT 1
    `;
    return { found: rows.length > 0 };
  } finally {
    await sql.end({ timeout: 5 });
  }
}
