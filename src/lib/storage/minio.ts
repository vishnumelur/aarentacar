import { S3Client } from '@aws-sdk/client-s3';
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
} as const;

export type BucketName = (typeof BUCKETS)[keyof typeof BUCKETS];
