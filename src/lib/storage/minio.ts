import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { env } from '@/lib/env';

let _client: S3Client | null = null;

export function s3(): S3Client {
  if (_client) return _client;
  const e = env();
  _client = new S3Client({
    region: 'us-east-1', // MinIO default; not used for routing
    endpoint: `${e.MINIO_USE_SSL ? 'https' : 'http'}://${e.MINIO_ENDPOINT}:${e.MINIO_PORT}`,
    credentials: {
      accessKeyId: e.MINIO_ACCESS_KEY,
      secretAccessKey: e.MINIO_SECRET_KEY,
    },
    forcePathStyle: true,
  });
  return _client;
}

export const BUCKETS = {
  vehicles: 'vehicles',
  documents: 'documents',
  inspections: 'inspections',
  agreements: 'agreements',
  // Daily pg_dump artifacts written by the pg-boss `daily-pg-dump` job (Plan #11).
  backups: 'backups',
} as const;

export type BucketName = (typeof BUCKETS)[keyof typeof BUCKETS];

/**
 * Download an object from MinIO into a Buffer. Used by the `scan-uploaded-file`
 * worker job (Plan #13) to stream uploaded bytes to clamd.
 */
export async function getObjectBuffer(bucket: string, key: string): Promise<Buffer> {
  const res = await s3().send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const body = res.Body as { transformToByteArray?: () => Promise<Uint8Array> } | undefined;
  if (!body?.transformToByteArray) {
    throw new Error(`empty body for ${bucket}/${key}`);
  }
  return Buffer.from(await body.transformToByteArray());
}
