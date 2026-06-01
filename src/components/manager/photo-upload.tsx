'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

export function PhotoUpload({
  vehicleId,
  onUploaded,
}: {
  vehicleId: string;
  onUploaded?: (key: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [lastKey, setLastKey] = useState<string | null>(null);

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
      if (!presignRes.ok) {
        throw new Error(`presign_failed_${presignRes.status}`);
      }
      const { url, key } = (await presignRes.json()) as { url: string; key: string };
      const put = await fetch(url, {
        method: 'PUT',
        headers: { 'content-type': file.type },
        body: file,
      });
      if (!put.ok) throw new Error(`upload_failed_${put.status}`);
      setLastKey(key);
      onUploaded?.(key);
      setMsg(`Uploaded: ${key}`);
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : 'upload_failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        onChange={onPick}
        disabled={busy}
      />
      <Button type="button" variant="ghost" size="sm" disabled={busy}>
        {busy ? 'Uploading…' : 'Upload photo'}
      </Button>
      {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
      {lastKey && (
        <span className="text-xs">
          Set this as primary photo: copy <code className="rounded bg-muted px-1">{lastKey}</code>
        </span>
      )}
    </div>
  );
}
