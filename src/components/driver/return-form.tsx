'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PhotoSlot } from './photo-slot';
import { recordReturn } from '@/lib/actions/return-inspection';

interface HandoverSnapshot {
  photos: string[];
  odometer: number | null;
  fuelLevel: number | null;
}

interface Props {
  bookingId: string;
  assignmentId: string;
  handover: HandoverSnapshot;
  handoverSignedUrls: Record<string, string>; // slot → signed GET URL
}

const SLOTS = ['front', 'back', 'left', 'right', 'odometer', 'fuel'] as const;
const SLOT_LABELS: Record<(typeof SLOTS)[number], string> = {
  front: 'Front',
  back: 'Back',
  left: 'Left',
  right: 'Right',
  odometer: 'Odometer',
  fuel: 'Fuel gauge',
};

export function ReturnForm({
  bookingId,
  assignmentId,
  handover,
  handoverSignedUrls,
}: Props) {
  const router = useRouter();
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [odometer, setOdometer] = useState('');
  const [fuelLevel, setFuelLevel] = useState('100');
  const [damageFound, setDamageFound] = useState(false);
  const [damageNotes, setDamageNotes] = useState('');
  const [damageEstimate, setDamageEstimate] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const allDone = SLOTS.every((s) => photos[s]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    if (!allDone) {
      setErr('All 6 photos are required.');
      return;
    }
    start(async () => {
      const res = await recordReturn({
        assignmentId,
        photos: Object.values(photos),
        odometer: Number(odometer),
        fuelLevel: Number(fuelLevel),
        damageNotes: damageFound ? damageNotes.trim() || undefined : undefined,
        damageEstimateAed:
          damageFound && damageEstimate ? Number(damageEstimate) : undefined,
      });
      if (!res.ok) {
        setErr(res.error);
      } else {
        router.push(`/driver/jobs/${assignmentId}`);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <section>
        <h3 className="mb-3 text-sm font-medium">
          Return photos — compare against handover
        </h3>

        <div className="space-y-4">
          {SLOTS.map((s, idx) => (
            <div key={s} className="space-y-2 rounded-lg border bg-card p-3">
              <div className="text-xs font-medium text-muted-foreground">
                {idx + 1}. {SLOT_LABELS[s]}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    At handover
                  </div>
                  <div className="mt-1 aspect-square overflow-hidden rounded border bg-muted">
                    {handoverSignedUrls[s] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={handoverSignedUrls[s]}
                        alt={`Handover ${SLOT_LABELS[s]}`}
                        className="size-full object-cover"
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center text-[10px] text-muted-foreground">
                        Not captured
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Now (return)
                  </div>
                  <div className="mt-1">
                    <PhotoSlot
                      bookingId={bookingId}
                      stage="return"
                      slot={s}
                      label="Tap to capture"
                      onUploaded={(key) =>
                        setPhotos((prev) => ({ ...prev, [s]: key }))
                      }
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="odometer">Odometer (km)</Label>
          <Input
            id="odometer"
            type="number"
            inputMode="numeric"
            value={odometer}
            onChange={(e) => setOdometer(e.target.value)}
            required
            min={0}
          />
          {handover.odometer !== null && (
            <p className="text-xs text-muted-foreground">
              At handover: {handover.odometer.toLocaleString()} km
            </p>
          )}
        </div>
        <div className="space-y-1">
          <Label htmlFor="fuelLevel">Fuel %</Label>
          <Input
            id="fuelLevel"
            type="number"
            inputMode="numeric"
            value={fuelLevel}
            onChange={(e) => setFuelLevel(e.target.value)}
            required
            min={0}
            max={100}
          />
          {handover.fuelLevel !== null && (
            <p className="text-xs text-muted-foreground">
              At handover: {handover.fuelLevel}%
            </p>
          )}
        </div>
      </section>

      <section className="space-y-3 rounded-lg border bg-card p-4">
        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={damageFound}
            onChange={(e) => setDamageFound(e.target.checked)}
            className="size-4"
          />
          <span className="font-medium">New damage found vs handover</span>
        </label>
        {damageFound && (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="damageNotes">Damage description</Label>
              <textarea
                id="damageNotes"
                value={damageNotes}
                onChange={(e) => setDamageNotes(e.target.value)}
                rows={3}
                maxLength={2000}
                className="w-full rounded-md border px-3 py-2 text-sm"
                placeholder="e.g. New scratch on rear passenger door, dent on front bumper"
                required={damageFound}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="damageEstimate">Estimated repair cost (AED, optional)</Label>
              <Input
                id="damageEstimate"
                type="number"
                inputMode="numeric"
                value={damageEstimate}
                onChange={(e) => setDamageEstimate(e.target.value)}
                min={0}
              />
              <p className="text-xs text-muted-foreground">
                The manager will review and settle the deposit.
              </p>
            </div>
          </div>
        )}
      </section>

      {err && <p className="text-sm text-destructive">{err}</p>}

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? 'Recording return…' : 'Confirm return'}
      </Button>
    </form>
  );
}
