'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createBooking, priceQuote, type CreateBookingOutcome } from '@/lib/actions/bookings';

const PROMO_ERROR_COPY: Record<string, string> = {
  code_not_found: 'That code does not exist.',
  inactive: 'That code is no longer active.',
  not_yet_valid: 'That code is not valid yet.',
  expired: 'That code has expired.',
  usage_exceeded: 'That code has reached its usage limit.',
  below_min_amount: 'Your subtotal is below the minimum for this code.',
  category_mismatch: 'That code does not apply to this vehicle.',
};

const ERROR_COPY: Record<string, string> = {
  forbidden: 'Please sign in as a customer.',
  invalid_input: 'Please check your inputs and try again.',
  profile_required: 'Complete your travel profile before booking.',
  kyc_required: 'Your account must be verified before you can book.',
  driver_under_age: 'You don\'t meet the minimum driver age for this vehicle.',
  license_required: 'Upload your driving license before booking a self-drive.',
  license_expired_during_rental: 'Your driving license expires before the return date — please re-upload an updated copy.',
  advance_book_violation: 'This category requires more advance notice.',
  vehicle_taken: 'Someone just booked this vehicle for these dates.',
  vehicle_not_found: 'Vehicle is no longer available.',
  no_rate_available: 'No pricing for the selected window. Try another duration.',
};

interface Props {
  vehicleId: string;
  pickupAt: string;
  returnAt: string;
  rentalKind: 'self_drive' | 'chauffeur';
  addonIds: string[];
  totalAed: number;
}

export function CheckoutForm({ vehicleId, pickupAt, returnAt, rentalKind, addonIds, totalAed }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [promoPending, startPromo] = useTransition();
  const [pickupAddress, setPickupAddress] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [appliedCode, setAppliedCode] = useState<string | null>(null);
  const [discountAed, setDiscountAed] = useState(0);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [effectiveTotal, setEffectiveTotal] = useState(totalAed);
  const [outcome, setOutcome] = useState<CreateBookingOutcome | null>(null);

  function onApplyPromo() {
    setPromoError(null);
    startPromo(async () => {
      const q = await priceQuote({ vehicleId, pickupAt, returnAt, addonIds, promoCode });
      if (!q.ok) {
        setPromoError('Could not re-price; try again.');
        return;
      }
      if (q.quote.promoError) {
        setPromoError(PROMO_ERROR_COPY[q.quote.promoError] ?? q.quote.promoError);
        setAppliedCode(null);
        setDiscountAed(0);
        setEffectiveTotal(q.quote.totalAed);
        return;
      }
      setAppliedCode(q.quote.appliedPromoCode);
      setDiscountAed(q.quote.discountAed);
      setEffectiveTotal(q.quote.totalAed);
    });
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setOutcome(null);
    start(async () => {
      const res = await createBooking({
        vehicleId,
        pickupAt,
        returnAt,
        rentalKind,
        addonIds,
        pickupAddress,
        promoCode: appliedCode ?? undefined,
      });
      setOutcome(res);
      if (res.ok) router.push(`/my-bookings/${res.code}`);
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="pickupAddress">Pickup address in Dubai</Label>
        <Input
          id="pickupAddress"
          name="pickupAddress"
          value={pickupAddress}
          onChange={(e) => setPickupAddress(e.target.value)}
          placeholder="e.g. The Address Downtown, Sheikh Mohammed bin Rashid Blvd"
          required
          minLength={2}
        />
        <p className="text-xs text-muted-foreground">
          The driver will deliver the vehicle to this address.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="promoCode">Promo code</Label>
        <div className="flex gap-2">
          <Input
            id="promoCode"
            name="promoCode"
            value={promoCode}
            onChange={(e) => setPromoCode(e.target.value)}
            placeholder="e.g. SUMMER25"
          />
          <Button type="button" variant="outline" onClick={onApplyPromo} disabled={promoPending || !promoCode}>
            {promoPending ? 'Applying…' : 'Apply'}
          </Button>
        </div>
        {promoError && <p className="text-xs text-destructive">{promoError}</p>}
        {appliedCode && (
          <p className="text-xs text-green-700">
            Code {appliedCode} applied — you save AED {discountAed.toLocaleString()}.
          </p>
        )}
      </div>

      <div className="rounded-md border bg-muted/30 p-4 text-sm">
        <div className="flex justify-between">
          <span>Rental type</span>
          <span className="capitalize">{rentalKind.replace('_', '-')}</span>
        </div>
        {discountAed > 0 && (
          <div className="flex justify-between text-green-700">
            <span>Discount ({appliedCode})</span>
            <span>− AED {discountAed.toLocaleString()}</span>
          </div>
        )}
        <div className="flex justify-between font-semibold">
          <span>Total due at checkout</span>
          <span>AED {effectiveTotal.toLocaleString()}</span>
        </div>
        <div className="mt-2 text-xs text-muted-foreground">
          Payment integration ships in Plan #7. For now the booking lands in &quot;pending payment&quot; and is visible to the manager for processing.
        </div>
      </div>

      {outcome && !outcome.ok && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {ERROR_COPY[outcome.error] ?? outcome.error}
          {outcome.error === 'advance_book_violation' && outcome.details?.minAdvanceDays !== undefined && (
            <span> ({outcome.details.minAdvanceDays} day minimum.)</span>
          )}
          {outcome.error === 'driver_under_age' && outcome.details?.minDriverAge !== undefined && (
            <span> (Must be {outcome.details.minDriverAge}+.)</span>
          )}
        </div>
      )}

      <Button type="submit" className="w-full" size="lg" disabled={pending || !pickupAddress}>
        {pending ? 'Placing booking…' : 'Place booking'}
      </Button>
    </form>
  );
}
