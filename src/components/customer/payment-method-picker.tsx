'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StripeElements } from './stripe-elements';
import {
  startCardPayment,
  startTabbyPayment,
  recordCashIntent,
  recordBankTransferIntent,
} from '@/lib/actions/checkout';

type Method = 'card' | 'tabby' | 'cod' | 'bank_transfer';

interface Props {
  code: string;
  totalAed: number;
  depositAed: number;
  bankTransferDetails: string | null;
}

const ERR: Record<string, string> = {
  provider_unconfigured: 'This payment method is not available right now.',
  provider_error: 'Payment provider error. Please try again.',
  invalid_status: 'This booking is no longer awaiting payment.',
  forbidden: 'You are not allowed to pay for this booking.',
  not_found: 'Booking not found.',
};

export function PaymentMethodPicker({ code, totalAed, depositAed, bankTransferDetails }: Props) {
  const router = useRouter();
  const [method, setMethod] = useState<Method | null>(null);
  const [pending, start] = useTransition();
  const [reference, setReference] = useState('');
  const [card, setCard] = useState<{ clientSecret: string; publishableKey: string } | null>(null);

  function fail(error: string) {
    toast.error(ERR[error] ?? `Payment failed: ${error}`);
  }

  function selectCard() {
    setMethod('card');
    start(async () => {
      const res = await startCardPayment({ code });
      if (res.ok) setCard({ clientSecret: res.clientSecret, publishableKey: res.publishableKey });
      else fail(res.error);
    });
  }

  function selectTabby() {
    setMethod('tabby');
    start(async () => {
      const res = await startTabbyPayment({ code });
      if (res.ok && res.redirectUrl) window.location.href = res.redirectUrl;
      else if (res.ok) toast.error('Could not start Tabby checkout.');
      else fail(res.error);
    });
  }

  function selectCod() {
    setMethod('cod');
  }

  function confirmCod() {
    start(async () => {
      const res = await recordCashIntent({ code });
      if (res.ok) {
        toast.success('Cash on delivery selected. Your booking is awaiting approval.');
        router.push(`/my-bookings/${code}`);
      } else fail(res.error);
    });
  }

  function selectBank() {
    setMethod('bank_transfer');
  }

  function confirmBank() {
    start(async () => {
      const res = await recordBankTransferIntent({ code, reference: reference.trim() || undefined });
      if (res.ok) {
        toast.success('Bank transfer recorded. We will confirm once funds arrive.');
        router.push(`/my-bookings/${code}`);
      } else fail(res.error);
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2">
        <Tile
          title="Card"
          desc={`Pay AED ${totalAed.toLocaleString()} now. A refundable AED ${depositAed.toLocaleString()} deposit is held on your card.`}
          active={method === 'card'}
          disabled={pending}
          onClick={selectCard}
        />
        <Tile
          title="Tabby — Pay in 4"
          desc="Split into 4 interest-free payments. Sharia-compliant. Redirects to Tabby."
          active={method === 'tabby'}
          disabled={pending}
          onClick={selectTabby}
        />
        <Tile
          title="Cash on Delivery"
          desc="Pay the driver in cash at handover. Booking goes for approval first."
          active={method === 'cod'}
          disabled={pending}
          onClick={selectCod}
        />
        <Tile
          title="Bank Transfer"
          desc="Transfer to our account and enter your reference. We confirm manually."
          active={method === 'bank_transfer'}
          disabled={pending}
          onClick={selectBank}
        />
      </div>

      {method === 'card' && card && (
        <div className="rounded-lg border bg-card p-6">
          <StripeElements
            clientSecret={card.clientSecret}
            publishableKey={card.publishableKey}
            bookingCode={code}
          />
        </div>
      )}

      {method === 'cod' && (
        <div className="rounded-lg border bg-card p-6 space-y-3">
          <p className="text-sm text-muted-foreground">
            You will pay AED {totalAed.toLocaleString()} in cash to the driver at handover. Your
            booking will be sent for manager approval now.
          </p>
          <Button onClick={confirmCod} disabled={pending}>
            {pending ? 'Confirming…' : 'Confirm cash on delivery'}
          </Button>
        </div>
      )}

      {method === 'bank_transfer' && (
        <div className="rounded-lg border bg-card p-6 space-y-3">
          <p className="text-sm font-medium">Transfer AED {totalAed.toLocaleString()} to:</p>
          <pre className="whitespace-pre-wrap rounded-md bg-muted p-3 text-sm">
            {bankTransferDetails || 'Bank details will be shared by our team.'}
          </pre>
          <label className="text-sm font-medium">Transfer reference (optional)</label>
          <Input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="e.g. TXN-12345"
            maxLength={120}
          />
          <Button onClick={confirmBank} disabled={pending}>
            {pending ? 'Saving…' : 'I will transfer'}
          </Button>
        </div>
      )}
    </div>
  );
}

function Tile({
  title,
  desc,
  active,
  disabled,
  onClick,
}: {
  title: string;
  desc: string;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg border p-4 text-left transition-colors disabled:opacity-50 ${
        active ? 'border-primary ring-2 ring-primary/40' : 'hover:border-primary/50'
      }`}
    >
      <div className="font-semibold">{title}</div>
      <div className="mt-1 text-sm text-muted-foreground">{desc}</div>
    </button>
  );
}
