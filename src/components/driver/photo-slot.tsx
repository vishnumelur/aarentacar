'use client';

import { useState } from 'react';
import { Camera, Check } from 'lucide-react';

interface Props {
  bookingId: string;
  stage: 'handover' | 'return';
  slot: string;
  label: string;
  onUploaded: (key: string) => void;
}

export function PhotoSlot({ bookingId, stage, slot, label, onUploaded }: Props) {
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [uploadedKey, setUploadedKey] = useState<string | null>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setErr(null);
    try {
      const presign = await fetch('/api/upload/presign', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          kind: 'inspection_photo',
          bookingId,
          stage,
          slot,
          mimeType: file.type,
        }),
      });
      if (!presign.ok) throw new Error(`presign_${presign.status}`);
      const { url, key } = (await presign.json()) as { url: string; key: string };
      const put = await fetch(url, {
        method: 'PUT',
        headers: { 'content-type': file.type },
        body: file,
      });
      if (!put.ok) throw new Error(`upload_${put.status}`);
      setUploadedKey(key);
      onUploaded(key);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'upload_failed');
    } finally {
      setUploading(false);
    }
  }

  return (
    <label
      className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-4 text-center text-sm cursor-pointer transition ${
        uploadedKey
          ? 'border-green-500 bg-green-50'
          : 'border-muted-foreground/30 hover:border-primary hover:bg-muted/30'
      }`}
    >
      <input
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onPick}
        disabled={uploading}
        className="sr-only"
      />
      {uploading ? (
        <span className="text-xs text-muted-foreground">Uploading…</span>
      ) : uploadedKey ? (
        <>
          <Check className="size-6 text-green-700" />
          <span className="mt-1 text-xs font-medium text-green-900">{label}</span>
        </>
      ) : (
        <>
          <Camera className="size-6 text-muted-foreground" />
          <span className="mt-1 text-xs font-medium">{label}</span>
        </>
      )}
      {err && <span className="mt-1 text-xs text-destructive">{err}</span>}
    </label>
  );
}
