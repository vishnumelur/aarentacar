'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  suggestDrivers,
  dispatchDriver,
  type DriverSuggestion,
} from '@/lib/actions/dispatch';

interface Props {
  bookingId: string;
}

export function DispatchPanel({ bookingId }: Props) {
  const router = useRouter();
  const [suggestions, setSuggestions] = useState<DriverSuggestion[] | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [actionErr, setActionErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    void (async () => {
      const res = await suggestDrivers({ bookingId });
      if (res.ok) {
        setSuggestions(res.suggestions);
        setLoadErr(null);
      } else {
        setLoadErr(res.error);
      }
    })();
  }, [bookingId]);

  function onConfirm(driverUserId: string) {
    setActionErr(null);
    start(async () => {
      const res = await dispatchDriver({ bookingId, driverUserId });
      if (res.ok) router.refresh();
      else setActionErr(`Dispatch failed: ${res.error}`);
    });
  }

  return (
    <section className="rounded-lg border-2 border-primary bg-card p-6 space-y-4">
      <div>
        <h2 className="font-semibold">Dispatch a driver</h2>
        <p className="text-sm text-muted-foreground">
          Drivers currently available, sorted by distance to pickup location.
        </p>
      </div>

      {loadErr === 'no_pickup_coords' && (
        <p className="text-sm text-muted-foreground">
          This booking has no pickup coordinates yet — drivers will be shown by name only.
        </p>
      )}
      {loadErr && loadErr !== 'no_pickup_coords' && (
        <p className="text-sm text-destructive">Could not load drivers: {loadErr}</p>
      )}

      {suggestions !== null && suggestions.length === 0 && (
        <p className="rounded-md border bg-muted/30 p-3 text-sm">
          No drivers are currently available. Onboard one in{' '}
          <a href="/manager/drivers" className="text-primary underline">
            Drivers
          </a>{' '}
          or toggle an existing driver to &quot;available&quot;.
        </p>
      )}

      {suggestions && suggestions.length > 0 && (
        <ul className="space-y-2">
          {suggestions.map((s, idx) => (
            <li
              key={s.userId}
              className="flex items-center justify-between gap-4 rounded-md border bg-card p-3"
            >
              <div className="flex items-center gap-3">
                <div className="grid size-10 place-items-center rounded-full bg-muted text-sm font-semibold">
                  {idx + 1}
                </div>
                <div>
                  <div className="font-medium">{s.fullName}</div>
                  <div className="text-xs text-muted-foreground">
                    {s.distanceKm !== null
                      ? `${s.distanceKm.toFixed(1)} km away`
                      : 'distance unknown'}
                    {s.lastPingMinutesAgo !== null &&
                      ` · pinged ${s.lastPingMinutesAgo}m ago`}
                  </div>
                </div>
              </div>
              <Button size="sm" onClick={() => onConfirm(s.userId)} disabled={pending}>
                {pending ? '…' : 'Confirm dispatch'}
              </Button>
            </li>
          ))}
        </ul>
      )}

      {actionErr && <p className="text-sm text-destructive">{actionErr}</p>}
    </section>
  );
}
