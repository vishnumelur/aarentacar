import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { pushSubscriptions } from '@/db/schema';
import { getWebPush } from './vapid';

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

export interface SendResult {
  sent: number;
  pruned: number;
  failed: number;
}

/**
 * Send a push notification to every subscription registered for `userId`.
 * Subscriptions that return 410 Gone or 404 Not Found are pruned from the
 * database (the user uninstalled the PWA or revoked the subscription).
 * Subscriptions that fail for transient reasons are left intact and counted
 * in `failed` so the caller can decide whether to log + alert.
 *
 * No-ops gracefully (returns zeros) if VAPID env vars are not configured —
 * useful in dev / CI where push hasn't been set up.
 */
export async function sendToUser(userId: string, payload: PushPayload): Promise<SendResult> {
  const wp = getWebPush();
  if (!wp) return { sent: 0, pruned: 0, failed: 0 };

  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));

  let sent = 0;
  let pruned = 0;
  let failed = 0;
  const body = JSON.stringify(payload);

  await Promise.all(
    subs.map(async (s) => {
      try {
        await wp.sendNotification(
          {
            endpoint: s.endpoint,
            keys: { p256dh: s.p256dh, auth: s.auth },
          },
          body,
        );
        sent += 1;
        // Best-effort lastUsedAt bump (don't block on it).
        void db
          .update(pushSubscriptions)
          .set({ lastUsedAt: new Date() })
          .where(eq(pushSubscriptions.id, s.id));
      } catch (err: unknown) {
        const status = (err as { statusCode?: number } | undefined)?.statusCode;
        if (status === 404 || status === 410) {
          await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, s.id));
          pruned += 1;
        } else {
          failed += 1;
          console.warn('push send failed', status, (err as Error)?.message);
        }
      }
    }),
  );

  return { sent, pruned, failed };
}
