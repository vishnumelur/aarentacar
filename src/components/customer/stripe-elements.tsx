'use client';

import { useMemo, useState } from 'react';
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { Button } from '@/components/ui/button';

interface Props {
  clientSecret: string;
  publishableKey: string;
  bookingCode: string;
}

/**
 * Mounts the Stripe PaymentElement (covers cards + Apple/Google Pay). On
 * confirm, Stripe redirects to the booking page; our webhook flips the booking
 * to pending_approval once payment succeeds.
 */
export function StripeElements({ clientSecret, publishableKey, bookingCode }: Props) {
  const stripePromise = useMemo<Promise<Stripe | null> | null>(
    () => (publishableKey ? loadStripe(publishableKey) : null),
    [publishableKey],
  );

  if (!stripePromise) {
    return (
      <p className="text-sm text-destructive">
        Card payments are not configured. Please choose another method.
      </p>
    );
  }

  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <CardForm bookingCode={bookingCode} />
    </Elements>
  );
}

function CardForm({ bookingCode }: { bookingCode: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);
    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/my-bookings/${bookingCode}?payment=card_success`,
      },
    });
    // confirmPayment only returns here on immediate error; success redirects.
    if (confirmError) {
      setError(confirmError.message ?? 'Payment failed. Please try again.');
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <PaymentElement />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={!stripe || submitting} className="w-full">
        {submitting ? 'Processing…' : 'Pay now'}
      </Button>
    </form>
  );
}
