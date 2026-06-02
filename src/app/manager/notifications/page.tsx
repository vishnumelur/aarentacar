import { and, desc, eq, isNull } from 'drizzle-orm';
import { db } from '@/db';
import { notifications } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { NotificationsInbox } from '@/components/manager/notifications-inbox';

export const dynamic = 'force-dynamic';

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const sp = await searchParams;
  const filter = sp.filter === 'unread' ? 'unread' : 'all';
  const user = await getCurrentUser();
  if (!user) return null;

  const where =
    filter === 'unread'
      ? and(eq(notifications.userId, user.id), isNull(notifications.readAt))
      : eq(notifications.userId, user.id);

  const rows = await db
    .select()
    .from(notifications)
    .where(where)
    .orderBy(desc(notifications.createdAt))
    .limit(100);

  return (
    <NotificationsInbox
      filter={filter}
      items={rows.map((n) => ({
        id: n.id,
        kind: n.kind,
        title: n.title,
        body: n.body,
        readAt: n.readAt ? n.readAt.toISOString() : null,
        createdAt: n.createdAt.toISOString(),
      }))}
    />
  );
}
