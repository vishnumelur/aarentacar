import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomBytes } from 'node:crypto';
import { s3, BUCKETS } from './minio';

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
};

export function isAllowedPhotoContentType(mime: string): boolean {
  return mime in MIME_TO_EXT;
}

export function buildVehiclePhotoKey(opts: {
  vehicleId: string;
  mimeType: string;
}): string {
  const ext = MIME_TO_EXT[opts.mimeType] ?? 'bin';
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const nonce = randomBytes(6).toString('hex').slice(0, 12);
  return `vehicles/${opts.vehicleId}/${yyyy}/${mm}/${nonce}.${ext}`;
}

export async function presignVehiclePhotoUpload(opts: {
  vehicleId: string;
  mimeType: string;
}): Promise<{ url: string; key: string; expiresInSec: number }> {
  if (!isAllowedPhotoContentType(opts.mimeType)) {
    throw new Error(`Unsupported content type: ${opts.mimeType}`);
  }
  const key = buildVehiclePhotoKey(opts);
  const url = await getSignedUrl(
    s3(),
    new PutObjectCommand({
      Bucket: BUCKETS.vehicles,
      Key: key,
      ContentType: opts.mimeType,
    }),
    { expiresIn: 600 },
  );
  return { url, key, expiresInSec: 600 };
}

export async function presignVehiclePhotoGet(key: string): Promise<string> {
  return getSignedUrl(s3(), new GetObjectCommand({ Bucket: BUCKETS.vehicles, Key: key }), {
    expiresIn: 3600,
  });
}
