'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PhotoSlot } from './photo-slot';
import { SignaturePad, type SignaturePadHandle } from './signature-pad';
import { recordHandover } from '@/lib/actions/handover';

interface Props {
  bookingId: string;
  assignmentId: string;
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

export function HandoverForm({ bookingId, assignmentId }: Props) {
  const router = useRouter();
  const sigRef = useRef<SignaturePadHandle | null>(null);
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [odometer, setOdometer] = useState('');
  const [fuelLevel, setFuelLevel] = useState('100');
  const [damageNotes, setDamageNotes] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const allPhotosDone = SLOTS.every((s) => photos[s]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);

    if (!allPhotosDone) {
      setErr('All 6 photos are required.');
      return;
    }

    const dataUrl = sigRef.current?.toDataUrl();
    if (!dataUrl) {
      setErr('Customer signature is required.');
      return;
    }

    start(async () => {
      try {
        // 1. Get a signature upload URL
        const presign = await fetch('/api/upload/presign', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            kind: 'signature',
            bookingId,
            stage: 'handover',
          }),
        });
        if (!presign.ok) throw new Error(`presign_${presign.status}`);
        const { url, key } = (await presign.json()) as { url: string; key: string };

        // 2. PUT the signature image
        const base64 = dataUrl.split(',')[1] ?? '';
        const binary = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
        const blob = new Blob([binary], { type: 'image/png' });
        const put = await fetch(url, {
          method: 'PUT',
          headers: { 'content-type': 'image/png' },
          body: blob,
        });
        if (!put.ok) throw new Error(`upload_${put.status}`);

        // 3. Submit the handover record
        const res = await recordHandover({
          assignmentId,
          photos: Object.values(photos),
          odometer: Number(odometer),
          fuelLevel: Number(fuelLevel),
          damageNotes: damageNotes.trim() || undefined,
          signatureKey: key,
          signatureDataUrl: dataUrl,
        });
        if (!res.ok) {
          setErr(res.error);
          return;
        }
        router.push(`/driver/jobs/${assignmentId}`);
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : 'unknown_error');
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <section>
        <h3 className="mb-3 text-sm font-medium">Vehicle condition photos</h3>
        <div className="grid grid-cols-3 gap-3">
          {SLOTS.map((s) => (
            <PhotoSlot
              key={s}
              bookingId={bookingId}
              stage="handover"
              slot={s}
              label={SLOT_LABELS[s]}
              onUploaded={(key) => setPhotos((prev) => ({ ...prev, [s]: key }))}
            />
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
        </div>
      </section>

      <section className="space-y-1">
        <Label htmlFor="damageNotes">Damage notes (optional)</Label>
        <textarea
          id="damageNotes"
          value={damageNotes}
          onChange={(e) => setDamageNotes(e.target.value)}
          rows={3}
          maxLength={2000}
          className="w-full rounded-md border px-3 py-2 text-sm"
          placeholder="Pre-existing scratches, dents, etc."
        />
      </section>

      <section className="space-y-2">
        <Label>Customer signature</Label>
        <SignaturePad ref={sigRef} />
      </section>

      {err && <p className="text-sm text-destructive">{err}</p>}

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? 'Recording handover…' : 'Confirm handover'}
      </Button>
    </form>
  );
}
