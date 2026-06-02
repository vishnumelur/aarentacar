import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.url(),
  ENCRYPTION_KEY: z
    .string()
    .min(43, 'ENCRYPTION_KEY must be 32 bytes base64-encoded (44 chars)'),
  SESSION_COOKIE_DOMAIN: z.string().min(1),
  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: z.coerce.number().int().default(25),
  SMTP_FROM: z.email().default('no-reply@aa-rentacar.com'),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  // Publishable key is safe to ship to the browser (Stripe Elements).
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.string().optional(),
  ),
  TABBY_SECRET_KEY: z.string().optional(),
  TABBY_PUBLIC_KEY: z.string().optional(),
  TABBY_WEBHOOK_SECRET: z.string().optional(),
  // Public base URL used to build Tabby success/cancel redirect URLs.
  APP_BASE_URL: z.string().default('http://localhost:3000'),
  // Bank-transfer payout details surfaced to customers (manager-configurable in Plan #10).
  BANK_TRANSFER_DETAILS: z.string().optional(),
  MAPBOX_TOKEN: z.string().optional(),
  // Public Mapbox token shipped to the browser for the live-tracking map.
  // Empty strings (from .env.example placeholders) coerce to undefined so
  // the map degrades to a non-map fallback instead of failing.
  NEXT_PUBLIC_MAPBOX_TOKEN: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.string().optional(),
  ),
  MINIO_ENDPOINT: z.string().default('localhost'),
  MINIO_PORT: z.coerce.number().int().default(9000),
  MINIO_ACCESS_KEY: z.string().default('minio-dev'),
  MINIO_SECRET_KEY: z.string().default('minio-dev-secret'),
  // z.coerce.boolean treats any non-empty string as true (incl. "false"),
  // so parse explicitly via a stringbool.
  MINIO_USE_SSL: z
    .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
    .transform((v) => v === true || v === 'true' || v === '1')
    .default(false),
  // Web Push / VAPID — optional during boot; required at runtime if push is wanted.
  // Empty strings (from .env.example placeholders) are coerced to undefined so
  // the validation on VAPID_SUBJECT doesn't trip in CI / dev. VAPID_SUBJECT is
  // typically a `mailto:` URI (not a bare email), so we accept either form.
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z
    .preprocess((v) => (v === '' ? undefined : v), z.string().optional()),
  VAPID_PRIVATE_KEY: z
    .preprocess((v) => (v === '' ? undefined : v), z.string().optional()),
  VAPID_SUBJECT: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z
      .string()
      .refine(
        (s) => s.startsWith('mailto:') || s.startsWith('https://') || /.+@.+\..+/.test(s),
        { message: 'must be a mailto: URI, https URL, or email' },
      )
      .optional(),
  ),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  return result.data;
}

let cached: Env | undefined;
export function env(): Env {
  if (!cached) cached = parseEnv(process.env);
  return cached;
}
