import * as React from 'react';
import { BrandLayout, Para, type MailLocale } from './layout';
import type { TemplatePayloads } from './types';

export function DriverDispatchedEmail({
  locale,
  name,
  bookingCode,
  driverName,
  pickupAt,
}: { locale: MailLocale } & TemplatePayloads['driver-dispatched']): React.ReactElement {
  const t =
    locale === 'ar'
      ? {
          preview: `سائقك في الطريق للحجز ${bookingCode}`,
          heading: 'تم إرسال سائق إليك',
          line1: `مرحباً ${name}، تم تعيين سائق لتوصيل مركبتك.`,
          driverLabel: 'السائق:',
          codeLabel: 'رقم الحجز:',
          pickupLabel: 'موعد التسليم:',
        }
      : {
          preview: `Your driver is on the way for booking ${bookingCode}`,
          heading: 'A driver has been dispatched',
          line1: `Hi ${name}, a driver has been assigned to deliver your vehicle.`,
          driverLabel: 'Driver:',
          codeLabel: 'Booking code:',
          pickupLabel: 'Pickup:',
        };
  return (
    <BrandLayout locale={locale} preview={t.preview} heading={t.heading}>
      <Para locale={locale}>{t.line1}</Para>
      <Para locale={locale}>
        <strong>{t.driverLabel}</strong> {driverName}
      </Para>
      <Para locale={locale}>
        <strong>{t.codeLabel}</strong> {bookingCode}
      </Para>
      <Para locale={locale}>
        <strong>{t.pickupLabel}</strong> {pickupAt}
      </Para>
    </BrandLayout>
  );
}
