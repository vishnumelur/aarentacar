import * as React from 'react';
import { BrandLayout, Para, type MailLocale } from './layout';
import type { TemplatePayloads } from './types';

export function BookingConfirmedEmail({
  locale,
  name,
  bookingCode,
  pickupAt,
  totalAed,
}: { locale: MailLocale } & TemplatePayloads['booking-confirmed']): React.ReactElement {
  const t =
    locale === 'ar'
      ? {
          preview: `تم تأكيد الحجز ${bookingCode}`,
          heading: 'تم تأكيد حجزك',
          line1: `مرحباً ${name}، تم تأكيد حجزك.`,
          codeLabel: 'رقم الحجز:',
          pickupLabel: 'موعد الاستلام:',
          totalLabel: 'الإجمالي:',
        }
      : {
          preview: `Booking ${bookingCode} confirmed`,
          heading: 'Your booking is confirmed',
          line1: `Hi ${name}, your booking is confirmed.`,
          codeLabel: 'Booking code:',
          pickupLabel: 'Pickup:',
          totalLabel: 'Total:',
        };
  return (
    <BrandLayout locale={locale} preview={t.preview} heading={t.heading}>
      <Para locale={locale}>{t.line1}</Para>
      <Para locale={locale}>
        <strong>{t.codeLabel}</strong> {bookingCode}
      </Para>
      <Para locale={locale}>
        <strong>{t.pickupLabel}</strong> {pickupAt}
      </Para>
      <Para locale={locale}>
        <strong>{t.totalLabel}</strong> AED {totalAed}
      </Para>
    </BrandLayout>
  );
}
