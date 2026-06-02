import Link from 'next/link';
import { notFound } from 'next/navigation';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import {
  bookings,
  bookingEvents,
  bookingAddons,
  addons,
  vehicles,
  vehicleTypes,
  users,
  payments,
  paymentHolds,
} from '@/db/schema';
import { ApprovalPanel } from '@/components/manager/approval-panel';
import { DispatchPanel } from '@/components/manager/dispatch-panel';
import { PaymentsPanel } from '@/components/manager/payments-panel';
import { confirmBankTransferForm } from '@/lib/actions/payments';
import { Button } from '@/components/ui/button';

export default async function ManagerBookingDetailPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  const [booking] = await db.select().from(bookings).where(eq(bookings.code, code)).limit(1);
  if (!booking) notFound();

  const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.id, booking.vehicleId)).limit(1);
  const [type] = vehicle
    ? await db.select().from(vehicleTypes).where(eq(vehicleTypes.id, vehicle.typeId)).limit(1)
    : [];
  const [customer] = await db.select().from(users).where(eq(users.id, booking.customerId)).limit(1);

  const addonsList = await db
    .select({
      id: bookingAddons.id,
      quantity: bookingAddons.quantity,
      unitPriceAed: bookingAddons.unitPriceAed,
      nameEn: addons.nameEn,
    })
    .from(bookingAddons)
    .leftJoin(addons, eq(addons.id, bookingAddons.addonId))
    .where(eq(bookingAddons.bookingId, booking.id));

  const events = await db
    .select()
    .from(bookingEvents)
    .where(eq(bookingEvents.bookingId, booking.id))
    .orderBy(asc(bookingEvents.createdAt));

  const [refundablePayment] = await db
    .select({ amountAed: payments.amountAed, method: payments.method })
    .from(payments)
    .where(
      and(
        eq(payments.bookingId, booking.id),
        eq(payments.status, 'succeeded'),
        inArray(payments.method, ['card', 'tabby']),
      ),
    )
    .orderBy(desc(payments.createdAt))
    .limit(1);

  const [hold] = await db
    .select({ id: paymentHolds.id, amountAed: paymentHolds.amountAed, status: paymentHolds.status })
    .from(paymentHolds)
    .where(eq(paymentHolds.bookingId, booking.id))
    .orderBy(desc(paymentHolds.createdAt))
    .limit(1);

  const [pendingBankTransfer] = await db
    .select({ id: payments.id, amountAed: payments.amountAed })
    .from(payments)
    .where(
      and(
        eq(payments.bookingId, booking.id),
        eq(payments.method, 'bank_transfer'),
        eq(payments.status, 'manual_pending'),
      ),
    )
    .orderBy(desc(payments.createdAt))
    .limit(1);

  return (
    <div className="space-y-6">
      <Link href="/manager/bookings" className="text-sm text-primary underline">
        ← All bookings
      </Link>

      <div className="flex items-baseline justify-between">
        <div>
          <div className="font-mono text-sm text-muted-foreground">{booking.code}</div>
          <h1 className="mt-1 text-2xl font-semibold">
            {vehicle?.make} {vehicle?.model}
          </h1>
        </div>
        <span className="rounded bg-muted px-3 py-1 text-sm capitalize">
          {booking.status.replace(/_/g, ' ')}
        </span>
      </div>

      {pendingBankTransfer && (
        <section className="rounded-lg border border-amber-300 bg-amber-50 p-6 text-sm">
          <h2 className="font-semibold">Bank transfer pending</h2>
          <p className="mt-1 text-muted-foreground">
            Customer flagged a bank transfer of AED {pendingBankTransfer.amountAed.toLocaleString()}.
            Confirm once funds arrive to move the booking to approval.
          </p>
          <form action={confirmBankTransferForm} className="mt-3">
            <input type="hidden" name="paymentId" value={pendingBankTransfer.id} />
            <Button type="submit" size="sm">
              Confirm receipt
            </Button>
          </form>
        </section>
      )}

      {booking.status === 'pending_approval' && <ApprovalPanel bookingId={booking.id} />}
      {booking.status === 'approved' && <DispatchPanel bookingId={booking.id} />}

      {(refundablePayment || hold) && (
        <PaymentsPanel
          bookingId={booking.id}
          refundable={refundablePayment ?? null}
          hold={hold ?? null}
        />
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border bg-card p-6 space-y-2 text-sm">
          <h2 className="font-semibold">Booking</h2>
          <Row label="Type" value={type?.nameEn ?? '—'} />
          <Row
            label="Rental"
            value={booking.rentalKind === 'self_drive' ? 'Self-drive' : 'With chauffeur'}
          />
          <Row label="Pickup" value={new Date(booking.pickupAt).toLocaleString()} />
          <Row label="Return" value={new Date(booking.returnAt).toLocaleString()} />
          <Row label="Address" value={booking.pickupAddress} />
        </section>

        <section className="rounded-lg border bg-card p-6 space-y-2 text-sm">
          <h2 className="font-semibold">Customer</h2>
          <Row label="Name" value={customer?.fullName ?? '—'} />
          <Row label="Email" value={customer?.email ?? '—'} />
          <Row label="Phone" value={customer?.phone ?? '—'} />
          <Row label="Verification" value={customer?.verificationStatus ?? '—'} />
          {customer && (
            <Link href={`/manager/customers/${customer.id}`} className="text-xs text-primary underline">
              Open customer detail →
            </Link>
          )}
        </section>

        <section className="rounded-lg border bg-card p-6 space-y-2 text-sm">
          <h2 className="font-semibold">Money</h2>
          <Row label="Subtotal" value={`AED ${booking.subtotalAed.toLocaleString()}`} />
          {booking.addonsAed > 0 && (
            <Row label="Add-ons" value={`+ AED ${booking.addonsAed.toLocaleString()}`} />
          )}
          {booking.discountAed > 0 && (
            <Row label="Discount" value={`− AED ${booking.discountAed.toLocaleString()}`} />
          )}
          <Row label="Deposit" value={`AED ${booking.depositAed.toLocaleString()}`} />
          <div className="border-t pt-2">
            <Row label="Total" value={`AED ${booking.totalAed.toLocaleString()}`} bold />
          </div>
        </section>

        {addonsList.length > 0 && (
          <section className="rounded-lg border bg-card p-6 space-y-2 text-sm">
            <h2 className="font-semibold">Add-ons</h2>
            <ul className="space-y-1">
              {addonsList.map((a) => (
                <li key={a.id} className="flex justify-between">
                  <span>
                    {a.quantity}× {a.nameEn}
                  </span>
                  <span className="text-muted-foreground">
                    AED {(a.unitPriceAed * a.quantity).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <section>
        <h2 className="text-lg font-semibold">Timeline</h2>
        <ul className="mt-2 space-y-2">
          {events.map((e) => (
            <li key={e.id} className="rounded-md border bg-card p-3 text-sm">
              <div className="flex justify-between">
                <span className="font-medium capitalize">{e.kind.replace(/_/g, ' ')}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(e.createdAt).toLocaleString()}
                </span>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-muted-foreground">
          Status transitions appear in the timeline above. Reassignment + driver acceptance ship in Plan #6.
        </p>
      </section>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? 'text-base font-semibold' : ''}`}>
      <span className={bold ? '' : 'text-muted-foreground'}>{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}
