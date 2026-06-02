import { db } from '@/db';
import { notifications, type NewNotification } from '@/db/schema';

export interface CreateNotificationInput {
  userId: string;
  kind: string;
  title: string;
  body?: string | null;
  payload?: unknown;
}

/**
 * Insert an in-app notification. Called synchronously today from dispatch /
 * approval / payment flows. Best-effort by convention at call sites (a failed
 * notification must never roll back the business action).
 *
 * TODO(Plan #11): replace the direct insert with a pg-boss enqueue so the
 * inbox write + email fan-out happen asynchronously off the request path.
 */
export async function createNotification(input: CreateNotificationInput): Promise<void> {
  const row: NewNotification = {
    userId: input.userId,
    kind: input.kind,
    title: input.title,
    body: input.body ?? null,
    payload: (input.payload ?? null) as NewNotification['payload'],
  };
  await db.insert(notifications).values(row);
}
