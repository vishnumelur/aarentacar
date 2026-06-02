import { sql, gte } from 'drizzle-orm';
import { db } from '@/db';
import { mailEvents } from '@/db/schema';

/**
 * Mail deliverability aggregates for the Super-Admin → System card
 * (Plan #12, Task 10). Reads counts from the `mail_events` table over a
 * trailing window. Best-effort: returns zeros if the table is unreachable so
 * the dashboard never hard-fails.
 */
export interface MailStats {
  windowHours: number;
  sent: number;
  failed: number;
  bounced: number;
  /** sent + failed + bounced — total attempts in window. */
  total: number;
  /** bounced / (sent + bounced), 0..1. */
  bounceRate: number;
}

export async function getMailStats(windowHours = 24): Promise<MailStats> {
  const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);
  try {
    const rows = await db
      .select({ status: mailEvents.status, count: sql<number>`count(*)::int` })
      .from(mailEvents)
      .where(gte(mailEvents.createdAt, since))
      .groupBy(mailEvents.status);

    const by = (s: string): number => rows.find((r) => r.status === s)?.count ?? 0;
    const sent = by('sent');
    const failed = by('failed');
    const bounced = by('bounced');
    const total = sent + failed + bounced;
    const deliveredOrBounced = sent + bounced;
    const bounceRate = deliveredOrBounced > 0 ? bounced / deliveredOrBounced : 0;
    return { windowHours, sent, failed, bounced, total, bounceRate };
  } catch {
    return { windowHours, sent: 0, failed: 0, bounced: 0, total: 0, bounceRate: 0 };
  }
}
