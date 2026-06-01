import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';
import * as schema from '@/db/schema';

const TEST_URL = process.env.DATABASE_URL ?? 'postgres://aa:aa@localhost:5432/aa_dev';

export const testClient = postgres(TEST_URL, { max: 1, prepare: false });
export const testDb = drizzle(testClient, { schema });

export async function clearAllTables(): Promise<void> {
  await testDb.execute(
    sql`TRUNCATE sessions, audit_logs, settings, users RESTART IDENTITY CASCADE`,
  );
}
