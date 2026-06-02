import * as React from 'react';
import { BrandLayout, Para, type MailLocale } from './layout';
import type { TemplatePayloads } from './types';

export function KycRejectedEmail({
  locale,
  name,
  reason,
}: { locale: MailLocale } & TemplatePayloads['kyc-rejected']): React.ReactElement {
  const t =
    locale === 'ar'
      ? {
          preview: 'نحتاج إلى مراجعة وثائقك',
          heading: 'تتطلب وثائقك إجراءً',
          line1: `مرحباً ${name}، لم نتمكن من الموافقة على بعض وثائقك.`,
          reasonLabel: 'السبب:',
          line2: 'يرجى رفع نسخة محدّثة من صفحة حسابك وسنراجعها مرة أخرى.',
        }
      : {
          preview: 'We need another look at your documents',
          heading: 'Your documents need attention',
          line1: `Hi ${name}, we could not approve some of your documents.`,
          reasonLabel: 'Reason:',
          line2: 'Please upload an updated copy from your account page and we will review again.',
        };
  return (
    <BrandLayout locale={locale} preview={t.preview} heading={t.heading}>
      <Para locale={locale}>{t.line1}</Para>
      <Para locale={locale}>
        <strong>{t.reasonLabel}</strong> {reason}
      </Para>
      <Para locale={locale}>{t.line2}</Para>
    </BrandLayout>
  );
}
