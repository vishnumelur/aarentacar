import webpush from 'web-push';
import { env } from '@/lib/env';

let configured = false;

export function getWebPush(): typeof webpush | null {
  const e = env();
  if (!e.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !e.VAPID_PRIVATE_KEY || !e.VAPID_SUBJECT) {
    return null;
  }
  if (!configured) {
    webpush.setVapidDetails(e.VAPID_SUBJECT, e.NEXT_PUBLIC_VAPID_PUBLIC_KEY, e.VAPID_PRIVATE_KEY);
    configured = true;
  }
  return webpush;
}

export function vapidPublicKey(): string | null {
  return env().NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null;
}
