import * as React from 'react';
import { BrandLayout, Para, type MailLocale } from './layout';
import type { TemplatePayloads } from './types';

export function ReturnReminderEmail({
  locale,
  name,
  bookingCode,
  returnAt,
}: { locale: MailLocale } & TemplatePayloads['return-reminder']): React.ReactElement {
  const t =
    locale === 'ar'
      ? {
          preview: `تذكير بإرجاع المركبة للحجز ${bookingCode}`,
          heading: 'تذكير بإرجاع المركبة',
          line1: `مرحباً ${name}، هذا تذكير بقرب موعد إرجاع مركبتك.`,
          codeLabel: 'رقم الحجز:',
          returnLabel: 'موعد الإرجاع:',
          line2: 'يرجى إعادة المركبة في الموعد لتجنب أي رسوم إضافية.',
        }
      : {
          preview: `Return reminder for booking ${bookingCode}`,
          heading: 'Vehicle return reminder',
          line1: `Hi ${name}, this is a reminder that your vehicle return is coming up.`,
          codeLabel: 'Booking code:',
          returnLabel: 'Return by:',
          line2: 'Please return the vehicle on time to avoid extra charges.',
        };
  return (
    <BrandLayout locale={locale} preview={t.preview} heading={t.heading}>
      <Para locale={locale}>{t.line1}</Para>
      <Para locale={locale}>
        <strong>{t.codeLabel}</strong> {bookingCode}
      </Para>
      <Para locale={locale}>
        <strong>{t.returnLabel}</strong> {returnAt}
      </Para>
      <Para locale={locale}>{t.line2}</Para>
    </BrandLayout>
  );
}
