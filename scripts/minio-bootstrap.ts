import { config as loadEnv } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

for (const file of ['.env.local', '.env']) {
  const p = resolve(process.cwd(), file);
  if (existsSync(p)) {
    loadEnv({ path: p });
    break;
  }
}

async function main() {
  const { CreateBucketCommand, HeadBucketCommand } = await import('@aws-sdk/client-s3');
  const { s3, BUCKETS } = await import('@/lib/storage/minio');
  const client = s3();

  for (const name of Object.values(BUCKETS)) {
    try {
      await client.send(new HeadBucketCommand({ Bucket: name }));
      console.warn(`Bucket exists: ${name}`);
    } catch {
      await client.send(new CreateBucketCommand({ Bucket: name }));
      console.warn(`Created bucket: ${name}`);
    }
  }
  process.exit(0);
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
