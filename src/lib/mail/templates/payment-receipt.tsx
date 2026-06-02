import * as React from 'react';
import { BrandLayout, Para, type MailLocale } from './layout';
import type { TemplatePayloads } from './types';

export function PaymentReceiptEmail({
  locale,
  name,
  bookingCode,
  amountAed,
}: { locale: MailLocale } & TemplatePayloads['payment-receipt']): React.ReactElement {
  const t =
    locale === 'ar'
      ? {
          preview: `إيصال الدفع للحجز ${bookingCode}`,
          heading: 'تم استلام دفعتك',
          line1: `مرحباً ${name}، شكراً لك. لقد استلمنا دفعتك.`,
          codeLabel: 'رقم الحجز:',
          amountLabel: 'المبلغ المدفوع:',
          line2: 'تجد اتفاقية الإيجار مرفقة بصيغة PDF.',
        }
      : {
          preview: `Payment receipt for booking ${bookingCode}`,
          heading: 'Payment received',
          line1: `Hi ${name}, thank you. We have received your payment.`,
          codeLabel: 'Booking code:',
          amountLabel: 'Amount paid:',
          line2: 'Your rental agreement is attached as a PDF.',
        };
  return (
    <BrandLayout locale={locale} preview={t.preview} heading={t.heading}>
      <Para locale={locale}>{t.line1}</Para>
      <Para locale={locale}>
        <strong>{t.codeLabel}</strong> {bookingCode}
      </Para>
      <Para locale={locale}>
        <strong>{t.amountLabel}</strong> AED {amountAed}
      </Para>
      <Para locale={locale}>{t.line2}</Para>
    </BrandLayout>
  );
}
