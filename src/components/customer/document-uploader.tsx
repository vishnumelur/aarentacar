'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { submitDocument } from '@/lib/actions/customer-documents';

type DocumentType =
  | 'passport'
  | 'visa'
  | 'emirates_id_front'
  | 'emirates_id_back'
  | 'driving_license_front'
  | 'driving_license_back'
  | 'international_permit';

export function DocumentUploader({
  type,
  requireExpiry,
}: {
  type: DocumentType;
  requireExpiry: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [expiry, setExpiry] = useState('');
  const [file, setFile] = useState<File | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setMsg('Please choose a file.');
      return;
    }
    if (requireExpiry && !expiry) {
      setMsg('Expiry date is required for this document.');
      return;
    }
    setBusy(true);
    setMsg(null);

    try {
      const presignRes = await fetch('/api/upload/presign', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind: 'customer_document', mimeType: file.type }),
      });
      if (!presignRes.ok) throw new Error(`presign_failed_${presignRes.status}`);
      const { url, key } = (await presignRes.json()) as { url: string; key: string };

      const put = await fetch(url, {
        method: 'PUT',
        headers: { 'content-type': file.type },
        body: file,
      });
      if (!put.ok) throw new Error(`upload_failed_${put.status}`);

      start(async () => {
        const res = await submitDocument({
          type,
          fileKey: key,
          expiryDate: expiry || undefined,
        });
        if (!res.ok) setMsg(`Submit failed: ${res.error}`);
        else {
          setMsg('Submitted for review.');
          setFile(null);
          setExpiry('');
          router.refresh();
        }
      });
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : 'upload_failed');
    } finally {
      setBusy(false);
    }
  }

  const working = busy || pending;

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor={`file-${type}`}>File (JPG, PNG, WebP, or PDF)</Label>
        <Input
          id={`file-${type}`}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          disabled={working}
          required
        />
      </div>

      {requireExpiry && (
        <div className="space-y-1">
          <Label htmlFor={`expiry-${type}`}>Expiry date</Label>
          <Input
            id={`expiry-${type}`}
            type="date"
            value={expiry}
            onChange={(e) => setExpiry(e.target.value)}
            disabled={working}
            required
          />
        </div>
      )}

      <Button type="submit" size="sm" disabled={working || !file}>
        {working ? 'Uploading…' : 'Submit for review'}
      </Button>
      {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
    </form>
  );
}
