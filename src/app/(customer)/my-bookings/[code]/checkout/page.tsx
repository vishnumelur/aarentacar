import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { bookings, vehicles } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { env } from '@/lib/env';
import { PaymentMethodPicker } from '@/components/customer/payment-method-picker';

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'customer') redirect('/');

  const [booking] = await db.select().from(bookings).where(eq(bookings.code, code)).limit(1);
  if (!booking) notFound();
  if (booking.customerId !== user.id) notFound();

  // Already paid / advanced — nothing to do here.
  if (booking.status !== 'pending_payment') {
    redirect(`/my-bookings/${code}`);
  }

  const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.id, booking.vehicleId)).limit(1);
  const bankDetails = env().BANK_TRANSFER_DETAILS ?? null;

  return (
    <main className="mx-auto max-w-3xl px-6 py-12 space-y-6">
      <Link href={`/my-bookings/${code}`} className="text-sm text-primary underline">
        ← Back to booking
      </Link>

      <div>
        <div className="font-mono text-sm text-muted-foreground">{booking.code}</div>
        <h1 className="mt-1 text-2xl font-semibold">Complete payment</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {vehicle?.make} {vehicle?.model} · Total AED {booking.totalAed.toLocaleString()}
        </p>
      </div>

      <PaymentMethodPicker
        code={booking.code}
        totalAed={booking.totalAed}
        depositAed={booking.depositAed}
        bankTransferDetails={bankDetails}
      />
    </main>
  );
}
