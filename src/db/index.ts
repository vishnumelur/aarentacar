import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '@/lib/env';
import * as schema from './schema';

const queryClient = postgres(env().DATABASE_URL, {
  max: env().NODE_ENV === 'production' ? 20 : 5,
  prepare: false,
});

export const db = drizzle(queryClient, { schema });

export type Database = typeof db;
