'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Addon } from '@/db/schema';
import { Button } from '@/components/ui/button';
import { priceQuote, type PriceQuote } from '@/lib/actions/bookings';
import { rateUnitLabel } from '@/lib/pricing/compute-rate';

interface Props {
  vehicleId: string;
  pickupAt: string;
  returnAt: string;
  addons: Addon[];
}

export function BookingPanel({ vehicleId, pickupAt, returnAt, addons }: Props) {
  const router = useRouter();
  const [rentalKind, setRentalKind] = useState<'self_drive' | 'chauffeur'>('self_drive');
  const [selectedAddonIds, setSelectedAddonIds] = useState<Set<string>>(new Set());
  const [quote, setQuote] = useState<PriceQuote | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [, startContinue] = useTransition();

  const addonIds = useMemo(() => Array.from(selectedAddonIds), [selectedAddonIds]);

  useEffect(() => {
    const t = setTimeout(() => {
      start(async () => {
        const res = await priceQuote({ vehicleId, pickupAt, returnAt, addonIds });
        if (!res.ok) {
          setErr(res.error);
          setQuote(null);
        } else {
          setErr(null);
          setQuote(res.quote);
        }
      });
    }, 100);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicleId, pickupAt, returnAt, addonIds.join(',')]);

  function toggleAddon(id: string) {
    setSelectedAddonIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function onContinue() {
    startContinue(() => {
      const params = new URLSearchParams({
        rentalKind,
        addons: addonIds.join(','),
      });
      router.push(
        `/checkout?vehicle=${vehicleId}&pickup=${encodeURIComponent(pickupAt)}&return=${encodeURIComponent(returnAt)}&${params.toString()}`,
      );
    });
  }

  return (
    <aside className="sticky top-6 space-y-4 rounded-lg border bg-card p-6">
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Rental type</h3>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setRentalKind('self_drive')}
            className={`rounded-md border p-3 text-left text-sm transition ${
              rentalKind === 'self_drive'
                ? 'border-primary bg-primary/5'
                : 'hover:bg-muted'
            }`}
          >
            <div className="font-medium">Self-drive</div>
            <div className="text-xs text-muted-foreground">Car delivered to you</div>
          </button>
          <button
            type="button"
            onClick={() => setRentalKind('chauffeur')}
            className={`rounded-md border p-3 text-left text-sm transition ${
              rentalKind === 'chauffeur'
                ? 'border-primary bg-primary/5'
                : 'hover:bg-muted'
            }`}
          >
            <div className="font-medium">With chauffeur</div>
            <div className="text-xs text-muted-foreground">Driver stays with you</div>
          </button>
        </div>
      </div>

      {addons.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Add-ons</h3>
          <div className="space-y-2">
            {addons.map((a) => (
              <label
                key={a.id}
                className="flex cursor-pointer items-start gap-3 rounded-md border p-2 text-sm hover:bg-muted"
              >
                <input
                  type="checkbox"
                  checked={selectedAddonIds.has(a.id)}
                  onChange={() => toggleAddon(a.id)}
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="font-medium">{a.nameEn}</div>
                    <div className="text-xs text-muted-foreground">
                      +AED {a.priceAed}
                    </div>
                  </div>
                  {a.descriptionEn && (
                    <div className="text-xs text-muted-foreground">{a.descriptionEn}</div>
                  )}
                </div>
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="border-t pt-4">
        {err && <p className="text-sm text-destructive">{err}</p>}
        {quote && (
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span>
                {quote.pick.unit === 'package'
                  ? `Package: ${quote.pick.packageName ?? '—'}`
                  : `${quote.pick.quantity} × ${rateUnitLabel(quote.pick.unit)}`}
              </span>
              <span>AED {quote.subtotalAed.toLocaleString()}</span>
            </div>
            {quote.addonsAed > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Add-ons</span>
                <span>+ AED {quote.addonsAed.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between text-muted-foreground">
              <span>Refundable deposit hold</span>
              <span>AED {quote.depositAed.toLocaleString()}</span>
            </div>
            <div className="flex justify-between border-t pt-2 text-lg font-semibold">
              <span>Total</span>
              <span>AED {quote.totalAed.toLocaleString()}</span>
            </div>
          </div>
        )}
        {pending && !quote && (
          <p className="text-sm text-muted-foreground">Calculating…</p>
        )}
      </div>

      <Button className="w-full" size="lg" disabled={!quote} onClick={onContinue}>
        Continue to checkout
      </Button>
    </aside>
  );
}
