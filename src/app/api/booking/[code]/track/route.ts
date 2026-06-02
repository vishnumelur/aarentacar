import { and, asc, desc, eq, gt, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { bookings, bookingAssignments, driverPings } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/get-current-user';

// SSE must never be statically rendered or cached.
export const dynamic = 'force-dynamic';

const POLL_MS = 2000;

interface PingEvent {
  driverId: string;
  lat: number;
  lng: number;
  heading: number | null;
  recordedAt: string;
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ code: string }> },
): Promise<Response> {
  const { code } = await ctx.params;

  const user = await getCurrentUser();
  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const [booking] = await db
    .select({ id: bookings.id, customerId: bookings.customerId })
    .from(bookings)
    .where(eq(bookings.code, code))
    .limit(1);

  if (!booking) {
    return new Response('Not found', { status: 404 });
  }

  // Authorize: the owning customer, or staff (manager/superadmin).
  const isOwner = booking.customerId === user.id;
  const isStaff = user.role === 'manager' || user.role === 'superadmin';
  if (!isOwner && !isStaff) {
    return new Response('Forbidden', { status: 403 });
  }

  // Active assignment = most recent accepted (fall back to offered) driver.
  const [assignment] = await db
    .select({ driverId: bookingAssignments.driverId })
    .from(bookingAssignments)
    .where(
      and(
        eq(bookingAssignments.bookingId, booking.id),
        inArray(bookingAssignments.status, ['accepted', 'offered']),
      ),
    )
    .orderBy(desc(bookingAssignments.assignedAt))
    .limit(1);

  if (!assignment) {
    // No driver yet — emit a tiny stream that just signals "no driver".
    const body = `event: no-driver\ndata: {}\n\n`;
    return new Response(body, {
      headers: {
        'content-type': 'text/event-stream',
        'cache-control': 'no-store',
        connection: 'keep-alive',
      },
    });
  }

  const driverId = assignment.driverId;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      let closed = false;
      let lastSeen = new Date(0);

      const safeEnqueue = (chunk: string): void => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          closed = true;
        }
      };

      const send = (event: PingEvent): void => {
        safeEnqueue(`data: ${JSON.stringify(event)}\n\n`);
      };

      // Initial state: the full ping history for this driver in chronological
      // order, so the client can draw the trail polyline immediately. Capped
      // to the most recent slice to bound memory on long routes.
      const history = await db
        .select()
        .from(driverPings)
        .where(eq(driverPings.driverId, driverId))
        .orderBy(desc(driverPings.recordedAt))
        .limit(200);

      for (const p of history.reverse()) {
        send({
          driverId: p.driverId,
          lat: p.lat,
          lng: p.lng,
          heading: p.heading,
          recordedAt: p.recordedAt.toISOString(),
        });
        lastSeen = p.recordedAt;
      }

      const interval = setInterval(async () => {
        if (closed) return;
        try {
          const latest = await db
            .select()
            .from(driverPings)
            .where(
              and(eq(driverPings.driverId, driverId), gt(driverPings.recordedAt, lastSeen)),
            )
            .orderBy(asc(driverPings.recordedAt));
          for (const p of latest) {
            send({
              driverId: p.driverId,
              lat: p.lat,
              lng: p.lng,
              heading: p.heading,
              recordedAt: p.recordedAt.toISOString(),
            });
            lastSeen = p.recordedAt;
          }
        } catch {
          // Transient DB error — keep the stream alive for the next tick.
        }
      }, POLL_MS);

      const abort = (): void => {
        if (closed) return;
        closed = true;
        clearInterval(interval);
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      req.signal.addEventListener('abort', abort);
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-store',
      connection: 'keep-alive',
    },
  });
}
