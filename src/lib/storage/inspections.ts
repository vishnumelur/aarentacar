import { PutObjectCommand, GetObjectCommand, type PutObjectCommandInput } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomBytes } from 'node:crypto';
import { s3, BUCKETS } from './minio';

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
};

export function isAllowedInspectionContentType(mime: string): boolean {
  return mime in MIME_TO_EXT;
}

export function buildInspectionPhotoKey(opts: {
  bookingId: string;
  stage: 'handover' | 'return';
  slot: string; // 'front'|'back'|'left'|'right'|'odometer'|'fuel'|'damage1'|'damage2'|'damage3'
  mimeType: string;
}): string {
  const ext = MIME_TO_EXT[opts.mimeType] ?? 'bin';
  const nonce = randomBytes(4).toString('hex').slice(0, 8);
  return `inspections/${opts.bookingId}/${opts.stage}/${opts.slot}-${nonce}.${ext}`;
}

export async function presignInspectionPhotoUpload(opts: {
  bookingId: string;
  stage: 'handover' | 'return';
  slot: string;
  mimeType: string;
}): Promise<{ url: string; key: string; expiresInSec: number }> {
  if (!isAllowedInspectionContentType(opts.mimeType)) {
    throw new Error(`Unsupported content type: ${opts.mimeType}`);
  }
  const key = buildInspectionPhotoKey(opts);
  const params: PutObjectCommandInput = {
    Bucket: BUCKETS.inspections,
    Key: key,
    ContentType: opts.mimeType,
  };
  const url = await getSignedUrl(s3(), new PutObjectCommand(params), { expiresIn: 600 });
  return { url, key, expiresInSec: 600 };
}

export async function presignInspectionGet(key: string): Promise<string> {
  return getSignedUrl(s3(), new GetObjectCommand({ Bucket: BUCKETS.inspections, Key: key }), {
    expiresIn: 3600,
  });
}

/**
 * Signature image upload — slot 'signature' lives directly in the inspection
 * folder. Always PNG.
 */
export function buildSignatureKey(bookingId: string, stage: 'handover' | 'return'): string {
  const nonce = randomBytes(4).toString('hex').slice(0, 8);
  return `inspections/${bookingId}/${stage}/signature-${nonce}.png`;
}

export async function presignSignatureUpload(bookingId: string, stage: 'handover' | 'return') {
  const key = buildSignatureKey(bookingId, stage);
  const url = await getSignedUrl(
    s3(),
    new PutObjectCommand({
      Bucket: BUCKETS.inspections,
      Key: key,
      ContentType: 'image/png',
    }),
    { expiresIn: 600 },
  );
  return { url, key, expiresInSec: 600 };
}
