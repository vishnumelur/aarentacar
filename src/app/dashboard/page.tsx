import Link from 'next/link';
import { redirect } from 'next/navigation';
import { desc, eq } from 'drizzle-orm';
import { CarFront, CalendarClock, UserCircle, ShieldCheck } from 'lucide-react';
import { db } from '@/db';
import { bookings, vehicles } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { LogoutButton } from '@/components/customer/logout-button';

const STATUS_TONES: Record<string, string> = {
  draft: 'bg-muted',
  pending_kyc: 'bg-amber-100 text-amber-900',
  pending_payment: 'bg-amber-100 text-amber-900',
  pending_approval: 'bg-blue-100 text-blue-900',
  approved: 'bg-blue-100 text-blue-900',
  dispatched: 'bg-blue-100 text-blue-900',
  in_progress: 'bg-green-100 text-green-900',
  completed: 'bg-green-100 text-green-900',
  cancelled: 'bg-muted text-muted-foreground',
  refunded: 'bg-muted text-muted-foreground',
};

const VERIFICATION_BANNER: Record<
  string,
  { tone: string; title: string; body: string; cta: string } | null
> = {
  unverified: {
    tone: 'bg-amber-100 text-amber-900',
    title: 'Verify your account to book',
    body: 'Upload your documents so our team can approve you — usually within 1 business hour.',
    cta: 'Start verification',
  },
  pending: {
    tone: 'bg-amber-100 text-amber-900',
    title: 'Documents under review',
    body: 'We are reviewing your documents. We will email you when it is done.',
    cta: 'View status',
  },
  rejected: {
    tone: 'bg-destructive/10 text-destructive',
    title: 'Verification rejected',
    body: 'Some documents need attention. Review the notes and re-upload.',
    cta: 'Fix documents',
  },
  verified: null,
};

const QUICK_LINKS = [
  { href: '/cars', label: 'Browse cars', desc: 'Find your next ride', Icon: CarFront },
  { href: '/my-bookings', label: 'My bookings', desc: 'View & track trips', Icon: CalendarClock },
  { href: '/profile', label: 'Profile', desc: 'Your details', Icon: UserCircle },
  { href: '/verification', label: 'Verification', desc: 'KYC documents', Icon: ShieldCheck },
];

export default async function CustomerDashboard() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  // Staff have their own portals; send them home (subdomain middleware routes them).
  if (user.role !== 'customer') redirect('/');

  const recent = await db
    .select({
      id: bookings.id,
      code: bookings.code,
      status: bookings.status,
      pickupAt: bookings.pickupAt,
      returnAt: bookings.returnAt,
      totalAed: bookings.totalAed,
      vehicleMake: vehicles.make,
      vehicleModel: vehicles.model,
    })
    .from(bookings)
    .leftJoin(vehicles, eq(vehicles.id, bookings.vehicleId))
    .where(eq(bookings.customerId, user.id))
    .orderBy(desc(bookings.createdAt))
    .limit(3);

  const banner = VERIFICATION_BANNER[user.verificationStatus];

  return (
    <main className="min-h-screen">
      <header className="flex items-center justify-between bg-primary px-6 py-3 text-primary-foreground">
        <div>
          <div className="text-lg font-semibold">AA Rent A Car</div>
          <div className="text-sm text-primary-foreground/80">Welcome, {user.fullName}</div>
        </div>
        <div className="flex items-center gap-4">
          {user.verificationStatus === 'verified' && (
            <span className="hidden rounded-full bg-white/15 px-3 py-1 text-xs sm:inline">
              Verified ✓
            </span>
          )}
          <LogoutButton />
        </div>
      </header>

      <div className="mx-auto max-w-4xl space-y-8 px-6 py-8">
        {banner && (
          <Link
            href="/verification"
            className={`block rounded-lg p-5 transition hover:opacity-90 ${banner.tone}`}
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="font-semibold">{banner.title}</h2>
                <p className="mt-1 text-sm">{banner.body}</p>
              </div>
              <span className="shrink-0 text-sm font-medium underline">{banner.cta}</span>
            </div>
          </Link>
        )}

        <section>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {QUICK_LINKS.map(({ href, label, desc, Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex flex-col gap-2 rounded-lg border bg-card p-4 transition hover:border-primary hover:shadow"
              >
                <Icon className="h-6 w-6 text-primary" aria-hidden />
                <div className="font-semibold">{label}</div>
                <div className="text-xs text-muted-foreground">{desc}</div>
              </Link>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Recent bookings</h2>
            {recent.length > 0 && (
              <Link href="/my-bookings" className="text-sm text-primary underline">
                View all
              </Link>
            )}
          </div>

          {recent.length === 0 ? (
            <div className="rounded-lg border bg-card p-10 text-center text-muted-foreground">
              You haven&apos;t booked anything yet.{' '}
              <Link href="/cars" className="text-primary underline">
                Browse vehicles
              </Link>
              .
            </div>
          ) : (
            <div className="space-y-3">
              {recent.map((r) => (
                <Link
                  key={r.id}
                  href={`/my-bookings/${r.code}`}
                  className="block rounded-lg border bg-card p-4 transition hover:border-primary hover:shadow"
                >
                  <div className="flex items-baseline justify-between">
                    <div>
                      <div className="font-mono text-sm text-muted-foreground">{r.code}</div>
                      <div className="font-semibold">
                        {r.vehicleMake} {r.vehicleModel}
                      </div>
                    </div>
                    <span
                      className={`rounded px-2 py-0.5 text-xs ${STATUS_TONES[r.status] ?? 'bg-muted'}`}
                    >
                      {r.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                    <div>Pickup: {new Date(r.pickupAt).toLocaleString()}</div>
                    <div>Return: {new Date(r.returnAt).toLocaleString()}</div>
                    <div className="text-right font-semibold text-foreground">
                      AED {r.totalAed.toLocaleString()}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
