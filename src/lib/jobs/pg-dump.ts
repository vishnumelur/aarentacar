import { spawn } from 'node:child_process';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { env } from '@/lib/env';
import { s3, BUCKETS } from '@/lib/storage/minio';

/**
 * Run `pg_dump` against DATABASE_URL and stream the gzipped output into the
 * MinIO `backups/` bucket (Plan #11 daily-pg-dump job). Returns the object key.
 *
 * Requires `pg_dump` on PATH (present in the postgres-client / app image used
 * by the worker container). Verify-on-deploy: confirm the binary version
 * matches the server's Postgres major version.
 */
export async function runPgDumpToBackups(now: Date = new Date()): Promise<string> {
  const stamp = now.toISOString().replace(/[:.]/g, '-');
  const key = `pg-dump-${stamp}.sql.gz`;

  // Parse DATABASE_URL into libpq env vars so the password is never visible in
  // the process argv (ps aux / /proc/<pid>/cmdline). pg_dump reads PGHOST etc.
  const dbUrl = new URL(env().DATABASE_URL);
  const pgEnv: NodeJS.ProcessEnv = { ...process.env };
  if (dbUrl.hostname) pgEnv.PGHOST = dbUrl.hostname;
  if (dbUrl.port) pgEnv.PGPORT = dbUrl.port;
  if (dbUrl.username) pgEnv.PGUSER = decodeURIComponent(dbUrl.username);
  if (dbUrl.password) pgEnv.PGPASSWORD = decodeURIComponent(dbUrl.password);
  const dbName = dbUrl.pathname.replace(/^\//, '');
  if (dbName) pgEnv.PGDATABASE = dbName;

  const STDERR_CAP = 64 * 1024; // stop accumulating runaway error output

  const buffer = await new Promise<Buffer>((resolve, reject) => {
    const dump = spawn('pg_dump', ['--no-owner', '--no-acl'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: pgEnv,
    });
    const gzip = spawn('gzip', ['-c'], { stdio: ['pipe', 'pipe', 'pipe'] });

    dump.stdout.pipe(gzip.stdin);

    const chunks: Buffer[] = [];
    let stderr = '';
    const appendStderr = (c: Buffer): void => {
      if (stderr.length < STDERR_CAP) stderr += c.toString();
    };
    gzip.stdout.on('data', (c: Buffer) => chunks.push(c));
    dump.stderr.on('data', appendStderr);
    gzip.stderr.on('data', appendStderr);

    dump.on('error', reject);
    gzip.on('error', reject);
    gzip.on('close', (code) => {
      if (code === 0) resolve(Buffer.concat(chunks));
      else reject(new Error(`pg_dump/gzip exited ${code}: ${stderr.slice(0, 500)}`));
    });
  });

  await s3().send(
    new PutObjectCommand({
      Bucket: BUCKETS.backups,
      Key: key,
      Body: buffer,
      ContentType: 'application/gzip',
    }),
  );

  return key;
}
