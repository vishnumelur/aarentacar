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

  const buffer = await new Promise<Buffer>((resolve, reject) => {
    const dump = spawn('pg_dump', ['--no-owner', '--no-acl', env().DATABASE_URL], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const gzip = spawn('gzip', ['-c'], { stdio: ['pipe', 'pipe', 'pipe'] });

    dump.stdout.pipe(gzip.stdin);

    const chunks: Buffer[] = [];
    let stderr = '';
    gzip.stdout.on('data', (c: Buffer) => chunks.push(c));
    dump.stderr.on('data', (c: Buffer) => (stderr += c.toString()));
    gzip.stderr.on('data', (c: Buffer) => (stderr += c.toString()));

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
