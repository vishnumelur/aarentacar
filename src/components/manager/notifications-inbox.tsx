'use client';

import Link from 'next/link';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { markNotificationRead, markAllNotificationsRead } from '@/lib/actions/notifications';

interface Item {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  readAt: string | null;
  createdAt: string;
}

interface Props {
  filter: 'all' | 'unread';
  items: Item[];
}

export function NotificationsInbox({ filter, items }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function onMarkRead(id: string) {
    const fd = new FormData();
    fd.set('id', id);
    start(async () => {
      const res = await markNotificationRead(fd);
      if (res.ok) router.refresh();
      else toast.error('Failed to mark read.');
    });
  }

  function onMarkAll() {
    start(async () => {
      const res = await markAllNotificationsRead();
      if (res.ok) {
        toast.success('All marked as read.');
        router.refresh();
      } else {
        toast.error('Failed.');
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Notifications</h1>
          <p className="text-sm text-muted-foreground">Your inbox.</p>
        </div>
        <Button variant="outline" size="sm" onClick={onMarkAll} disabled={pending}>
          Mark all as read
        </Button>
      </div>

      <div className="flex gap-2 text-sm">
        <Link
          href="/manager/notifications?filter=all"
          className={`rounded-md border px-3 py-1.5 ${filter === 'all' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
        >
          All
        </Link>
        <Link
          href="/manager/notifications?filter=unread"
          className={`rounded-md border px-3 py-1.5 ${filter === 'unread' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
        >
          Unread
        </Link>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No notifications.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((n) => (
            <li
              key={n.id}
              className={`flex items-start justify-between gap-4 rounded-md border p-4 text-sm ${n.readAt ? 'bg-card' : 'bg-primary/5 border-primary/30'}`}
            >
              <div>
                <div className="flex items-center gap-2">
                  {!n.readAt && <span className="size-2 rounded-full bg-primary" aria-label="unread" />}
                  <span className="font-medium">{n.title}</span>
                </div>
                {n.body && <p className="mt-1 text-muted-foreground">{n.body}</p>}
                <span className="mt-1 block text-xs text-muted-foreground">
                  {new Date(n.createdAt).toLocaleString()}
                </span>
              </div>
              {!n.readAt && (
                <Button variant="ghost" size="sm" onClick={() => onMarkRead(n.id)} disabled={pending}>
                  Mark read
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
