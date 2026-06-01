import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/db';

export async function GET(): Promise<NextResponse> {
  const startedAt = process.uptime();
  let dbOk = false;
  try {
    await db.execute(sql`select 1`);
    dbOk = true;
  } catch {
    dbOk = false;
  }
  return NextResponse.json(
    {
      status: dbOk ? 'ok' : 'degraded',
      uptime_seconds: Math.round(startedAt),
      build: process.env.GIT_SHA ?? 'dev',
      db: dbOk,
    },
    { status: dbOk ? 200 : 503 },
  );
}
