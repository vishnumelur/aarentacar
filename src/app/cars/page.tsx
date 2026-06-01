import Link from 'next/link';
import { searchVehicles } from '@/lib/actions/bookings';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface SP {
  category?: 'car' | 'limousine';
  pickup?: string;
  return?: string;
}

export default async function CarsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  if (!sp.pickup || !sp.return) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-12">
        <h1 className="text-2xl font-semibold">Browse vehicles</h1>
        <p className="mt-2 text-muted-foreground">
          Use the search widget on the{' '}
          <Link href="/" className="text-primary underline">
            homepage
          </Link>{' '}
          to pick pickup and return dates.
        </p>
      </main>
    );
  }

  const result = await searchVehicles({
    categorySlug: sp.category,
    pickupAt: sp.pickup,
    returnAt: sp.return,
  });

  if (!result.ok) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-12 space-y-4">
        <h1 className="text-2xl font-semibold">No vehicles available</h1>
        {result.error === 'advance_book_violation' && (
          <p className="text-muted-foreground">
            {sp.category === 'limousine' ? 'Limousine' : 'Car'} bookings require{' '}
            <strong>at least {result.details?.minAdvanceDays} day(s)</strong> notice.
            Please pick a later pickup date.
          </p>
        )}
        {result.error === 'returns_before_pickup' && (
          <p className="text-destructive">Return time must be after pickup time.</p>
        )}
        {result.error === 'invalid_input' && (
          <p className="text-destructive">Invalid search inputs.</p>
        )}
        <Link href="/" className="text-primary underline">
          ← Back to search
        </Link>
      </main>
    );
  }

  const { results } = result;
  const pickup = new Date(sp.pickup);
  const ret = new Date(sp.return);

  return (
    <main className="mx-auto max-w-6xl px-6 py-12 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">
          {results.length} {sp.category === 'limousine' ? 'limousine(s)' : 'vehicle(s)'} available
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pickup {pickup.toLocaleString()} → Return {ret.toLocaleString()}
        </p>
      </div>

      {results.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            No vehicles match your dates. Try a different window or category.{' '}
            <Link href="/" className="text-primary underline">
              Modify search
            </Link>
            .
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((r) => (
            <Card key={r.vehicleId} className="overflow-hidden">
              <div className="aspect-[16/10] bg-muted">
                {/* Photo presigning is on the manager side; here we show a placeholder for now */}
                {r.primaryPhotoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src="/placeholder-car.svg"
                    alt={`${r.make} ${r.model}`}
                    className="size-full object-cover"
                  />
                ) : (
                  <div className="flex size-full items-center justify-center text-muted-foreground">
                    No photo
                  </div>
                )}
              </div>
              <CardContent className="space-y-2 p-4">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  {r.typeNameEn}
                </div>
                <div className="text-lg font-semibold">
                  {r.make} {r.model}
                </div>
                <div className="text-xs text-muted-foreground">
                  {r.year} · {r.seats} seats · {r.transmission}
                </div>
                <div className="pt-2">
                  <div className="text-xs text-muted-foreground">
                    From AED {Math.round(r.pick.totalAed / Math.max(1, r.pick.quantity)).toLocaleString()} / {r.pick.unit === 'package' ? 'package' : r.pick.unit.replace(/ly$/, '')}
                  </div>
                  <div className="text-2xl font-semibold">
                    AED {r.pick.totalAed.toLocaleString()}
                    <span className="ms-1 text-sm font-normal text-muted-foreground">total</span>
                  </div>
                </div>
                <Link
                  href={`/cars/${r.vehicleId}?pickup=${encodeURIComponent(sp.pickup!)}&return=${encodeURIComponent(sp.return!)}`}
                  className="block pt-2"
                >
                  <Button className="w-full">Continue</Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
