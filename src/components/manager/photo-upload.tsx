'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { setVehiclePrimaryPhoto } from '@/lib/actions/vehicles';

export function PhotoUpload({
  vehicleId,
  hasPrimary,
}: {
  vehicleId: string;
  hasPrimary: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setMsg(null);
    try {
      const presignRes = await fetch('/api/upload/presign', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          kind: 'vehicle_photo',
          vehicleId,
          mimeType: file.type,
        }),
      });
      if (!presignRes.ok) throw new Error(`presign_failed_${presignRes.status}`);

      const { url, key } = (await presignRes.json()) as { url: string; key: string };
      const put = await fetch(url, {
        method: 'PUT',
        headers: { 'content-type': file.type },
        body: file,
      });
      if (!put.ok) throw new Error(`upload_failed_${put.status}`);

      // Auto-save as primary if this is the first photo, otherwise just notify.
      if (!hasPrimary) {
        start(async () => {
          const res = await setVehiclePrimaryPhoto({ vehicleId, key });
          setMsg(res.ok ? `Uploaded and set as primary: ${key}` : `Uploaded but save failed: ${res.error}`);
          if (res.ok) router.refresh();
        });
      } else {
        setMsg(
          `Uploaded: ${key}. Existing primary kept — paste this key into "Primary photo URL" to swap.`,
        );
      }
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : 'upload_failed');
    } finally {
      setBusy(false);
    }
  }

  const isWorking = busy || pending;

  return (
    <div className="flex items-center gap-3">
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        onChange={onPick}
        disabled={isWorking}
      />
      <Button type="button" variant="ghost" size="sm" disabled={isWorking}>
        {isWorking ? 'Uploading…' : 'Upload photo'}
      </Button>
      {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
    </div>
  );
}
