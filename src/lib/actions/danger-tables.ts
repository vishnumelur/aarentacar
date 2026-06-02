/**
 * Allowlist of tables the danger zone may DROP (Plan #11). Kept separate from
 * the `'use server'` actions module so it can export a plain const (a
 * 'use server' file may only export async functions).
 *
 * audit_logs is intentionally excluded — it's immutable per spec §13. Core
 * tables (users, bookings, payments) are excluded too.
 */
export const DROPPABLE_TABLES = [
  'driver_pings',
  'booking_events',
  'webhook_events',
  'notifications',
  'push_subscriptions',
] as const;

export type DroppableTable = (typeof DROPPABLE_TABLES)[number];
