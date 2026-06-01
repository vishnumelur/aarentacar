import '@testing-library/jest-dom/vitest';

// Provide deterministic env vars for tests so modules that read env at
// import-time (e.g. src/db/index.ts) don't fail when DATABASE_URL is
// missing on a fresh CI runner. Real test runs against a live DB still
// expect docker compose -f docker-compose.dev.yml up postgres.
// NODE_ENV is already set to 'test' by vitest.
const env = process.env as Record<string, string | undefined>;
env.DATABASE_URL ||= 'postgres://aa:aa@localhost:5432/aa_dev';
env.ENCRYPTION_KEY ||= 'dGVzdGtleXRlc3RrZXl0ZXN0a2V5dGVzdGtleXRlc3Q=';
env.SESSION_COOKIE_DOMAIN ||= 'localhost';
