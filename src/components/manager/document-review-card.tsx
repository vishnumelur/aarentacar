'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { CustomerDocument } from '@/db/schema';
import { Button } from '@/components/ui/button';
import { approveDocument, rejectDocument } from '@/lib/actions/kyc-review';

const LABELS: Record<string, string> = {
  passport: 'Passport',
  visa: 'UAE Visa',
  emirates_id_front: 'Emirates ID (front)',
  emirates_id_back: 'Emirates ID (back)',
  driving_license_front: 'Driving License (front)',
  driving_license_back: 'Driving License (back)',
  international_permit: 'International Driving Permit',
};

export function DocumentReviewCard({
  doc,
  signedUrl,
}: {
  doc: CustomerDocument;
  signedUrl: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [showReject, setShowReject] = useState(false);
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  function onApprove() {
    setMsg(null);
    const fd = new FormData();
    fd.set('id', doc.id);
    start(async () => {
      const res = await approveDocument(fd);
      if (!res.ok) setMsg(`Error: ${res.error}`);
      else router.refresh();
    });
  }

  function onReject(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    const fd = new FormData(e.currentTarget);
    fd.set('id', doc.id);
    start(async () => {
      const res = await rejectDocument(fd);
      if (!res.ok) setMsg(`Error: ${res.error}`);
      else {
        setShowReject(false);
        setNote('');
        router.refresh();
      }
    });
  }

  const isImage = !signedUrl.match(/\.pdf(\?|$)/i);

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-baseline justify-between">
        <h3 className="font-medium">{LABELS[doc.type] ?? doc.type}</h3>
        <span
          className={`rounded px-2 py-0.5 text-xs ${
            doc.status === 'pending'
              ? 'bg-amber-100 text-amber-900'
              : doc.status === 'approved'
                ? 'bg-green-100 text-green-900'
                : doc.status === 'rejected'
                  ? 'bg-destructive/10 text-destructive'
                  : 'bg-muted'
          }`}
        >
          {doc.status}
        </span>
      </div>

      <div className="text-xs text-muted-foreground">
        Uploaded {new Date(doc.uploadedAt).toLocaleString()}
        {doc.expiryDate && ` · expires ${doc.expiryDate}`}
      </div>

      {isImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={signedUrl} alt={doc.type} className="max-h-96 w-auto rounded border" />
      ) : (
        <a
          href={signedUrl}
          target="_blank"
          rel="noreferrer"
          className="text-sm text-primary underline"
        >
          Open PDF in new tab
        </a>
      )}

      {doc.status === 'pending' && (
        <div className="flex flex-col gap-2">
          {!showReject ? (
            <div className="flex gap-2">
              <Button size="sm" onClick={onApprove} disabled={pending}>
                {pending ? '…' : 'Approve'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowReject(true)}
                disabled={pending}
              >
                Reject
              </Button>
            </div>
          ) : (
            <form onSubmit={onReject} className="space-y-2">
              <textarea
                name="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Reason for rejection (visible to customer)"
                rows={2}
                className="w-full rounded-md border px-3 py-2 text-sm"
                required
              />
              <div className="flex gap-2">
                <Button type="submit" size="sm" variant="destructive" disabled={pending || !note.trim()}>
                  {pending ? '…' : 'Confirm reject'}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setShowReject(false);
                    setNote('');
                  }}
                  disabled={pending}
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </div>
      )}

      {doc.status === 'rejected' && doc.reviewNote && (
        <p className="text-sm text-destructive">Note: {doc.reviewNote}</p>
      )}

      {msg && <p className="text-sm text-destructive">{msg}</p>}
    </div>
  );
}
