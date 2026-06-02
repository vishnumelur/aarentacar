'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { issueRefund } from '@/lib/actions/refunds';
import { captureDeposit, releaseDeposit } from '@/lib/actions/deposits';

interface RefundablePayment {
  amountAed: number;
  method: string;
}

interface DepositHold {
  id: string;
  amountAed: number;
  status: string;
}

interface Props {
  bookingId: string;
  refundable: RefundablePayment | null;
  hold: DepositHold | null;
}

export function PaymentsPanel({ bookingId, refundable, hold }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [showRefund, setShowRefund] = useState(false);
  const [refundAmount, setRefundAmount] = useState(String(refundable?.amountAed ?? ''));
  const [refundReason, setRefundReason] = useState('');
  const [captureAmount, setCaptureAmount] = useState(String(hold?.amountAed ?? ''));

  function onRefund() {
    start(async () => {
      const res = await issueRefund({
        bookingId,
        amountAed: Number(refundAmount),
        reason: refundReason.trim() || undefined,
      });
      if (res.ok) {
        toast.success('Refund issued.');
        setShowRefund(false);
        router.refresh();
      } else {
        toast.error(`Refund failed: ${res.error}`);
      }
    });
  }

  function onCapture() {
    start(async () => {
      const res = await captureDeposit({ holdId: hold!.id, amountAed: Number(captureAmount) });
      if (res.ok) {
        toast.success('Deposit captured.');
        router.refresh();
      } else {
        toast.error(`Capture failed: ${res.error}`);
      }
    });
  }

  function onRelease() {
    start(async () => {
      const res = await releaseDeposit({ holdId: hold!.id });
      if (res.ok) {
        toast.success('Deposit released.');
        router.refresh();
      } else {
        toast.error(`Release failed: ${res.error}`);
      }
    });
  }

  return (
    <section className="rounded-lg border bg-card p-6 space-y-4 text-sm">
      <h2 className="font-semibold">Payments</h2>

      {hold && hold.status === 'held' && (
        <div className="space-y-2 rounded-md border p-3">
          <div className="font-medium">
            Deposit hold · AED {hold.amountAed.toLocaleString()} held
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={1}
              max={hold.amountAed}
              value={captureAmount}
              onChange={(e) => setCaptureAmount(e.target.value)}
              className="w-32"
            />
            <Button size="sm" onClick={onCapture} disabled={pending}>
              Capture
            </Button>
            <Button size="sm" variant="ghost" onClick={onRelease} disabled={pending}>
              Release full
            </Button>
          </div>
        </div>
      )}

      {hold && hold.status !== 'held' && (
        <div className="text-muted-foreground">
          Deposit {hold.status.replace(/_/g, ' ')}.
        </div>
      )}

      {refundable ? (
        !showRefund ? (
          <Button size="sm" variant="outline" onClick={() => setShowRefund(true)} disabled={pending}>
            Refund {refundable.method} payment
          </Button>
        ) : (
          <div className="space-y-2 rounded-md border p-3">
            <label className="font-medium">Refund amount (AED)</label>
            <Input
              type="number"
              min={1}
              max={refundable.amountAed}
              value={refundAmount}
              onChange={(e) => setRefundAmount(e.target.value)}
              className="w-40"
            />
            <label className="font-medium">Reason</label>
            <Input
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              maxLength={500}
              placeholder="e.g. Cancellation within policy"
            />
            <div className="flex gap-2">
              <Button size="sm" variant="destructive" onClick={onRefund} disabled={pending}>
                {pending ? '…' : 'Confirm refund'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowRefund(false)} disabled={pending}>
                Cancel
              </Button>
            </div>
          </div>
        )
      ) : (
        <div className="text-muted-foreground">No refundable card/Tabby payment.</div>
      )}
    </section>
  );
}
