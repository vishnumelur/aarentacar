import * as React from 'react';
import { BrandLayout, Para, type MailLocale } from './layout';
import type { TemplatePayloads } from './types';

export function KycApprovedEmail({
  locale,
  name,
}: { locale: MailLocale } & TemplatePayloads['kyc-approved']): React.ReactElement {
  const t =
    locale === 'ar'
      ? {
          preview: 'تمت الموافقة على وثائقك',
          heading: 'تم التحقق من حسابك',
          line1: `مرحباً ${name}، تمت الموافقة على وثائقك بنجاح.`,
          line2: 'يمكنك الآن إتمام الحجوزات واستلام المركبات.',
        }
      : {
          preview: 'Your documents were approved',
          heading: 'Your account is verified',
          line1: `Hi ${name}, your documents have been approved.`,
          line2: 'You can now complete bookings and pick up vehicles.',
        };
  return (
    <BrandLayout locale={locale} preview={t.preview} heading={t.heading}>
      <Para locale={locale}>{t.line1}</Para>
      <Para locale={locale}>{t.line2}</Para>
    </BrandLayout>
  );
}
