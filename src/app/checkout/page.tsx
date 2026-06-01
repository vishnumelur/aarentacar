import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { priceQuote } from '@/lib/actions/bookings';
import { CheckoutForm } from '@/components/public/checkout-form';

interface SP {
  vehicle?: string;
  pickup?: string;
  return?: string;
  rentalKind?: 'self_drive' | 'chauffeur';
  addons?: string;
}

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;

  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent('/checkout?' + new URLSearchParams(sp as Record<string, string>).toString())}`);
  }

  if (user.role !== 'customer') redirect('/');

  // KYC gate
  if (user.verificationStatus !== 'verified') {
    redirect(`/verification?next=${encodeURIComponent('/checkout?' + new URLSearchParams(sp as Record<string, string>).toString())}`);
  }

  if (!sp.vehicle || !sp.pickup || !sp.return || !sp.rentalKind) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-2xl font-semibold">Incomplete booking</h1>
        <p className="mt-2 text-muted-foreground">
          Start over from the{' '}
          <Link href="/" className="text-primary underline">
            homepage
          </Link>
          .
        </p>
      </main>
    );
  }

  const addonIds = sp.addons ? sp.addons.split(',').filter(Boolean) : [];
  const q = await priceQuote({
    vehicleId: sp.vehicle,
    pickupAt: sp.pickup,
    returnAt: sp.return,
    addonIds,
  });

  if (!q.ok) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-2xl font-semibold">Pricing unavailable</h1>
        <p className="mt-2 text-muted-foreground">{q.error}</p>
        <Link href="/" className="text-primary underline">
          Back to search
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Confirm your booking</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Verified as {user.fullName} ({user.email})
        </p>
      </div>

      <div className="rounded-lg border bg-card p-6 space-y-3 text-sm">
        <Row label="Pickup" value={new Date(sp.pickup).toLocaleString()} />
        <Row label="Return" value={new Date(sp.return).toLocaleString()} />
        <Row label="Subtotal" value={`AED ${q.quote.subtotalAed.toLocaleString()}`} />
        {q.quote.addonsAed > 0 && (
          <Row label="Add-ons" value={`+ AED ${q.quote.addonsAed.toLocaleString()}`} />
        )}
        <Row label="Refundable deposit" value={`AED ${q.quote.depositAed.toLocaleString()}`} />
        <div className="border-t pt-3">
          <Row label="Total" value={`AED ${q.quote.totalAed.toLocaleString()}`} bold />
        </div>
      </div>

      <CheckoutForm
        vehicleId={sp.vehicle}
        pickupAt={sp.pickup}
        returnAt={sp.return}
        rentalKind={sp.rentalKind}
        addonIds={addonIds}
        totalAed={q.quote.totalAed}
      />
    </main>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? 'text-lg font-semibold' : ''}`}>
      <span className={bold ? '' : 'text-muted-foreground'}>{label}</span>
      <span>{value}</span>
    </div>
  );
}
