import * as React from 'react';
import { BrandLayout, Para, type MailLocale } from './layout';
import type { TemplatePayloads } from './types';

export function WelcomeEmail({
  locale,
  name,
}: { locale: MailLocale } & TemplatePayloads['welcome']): React.ReactElement {
  const t =
    locale === 'ar'
      ? {
          preview: 'مرحباً بك في AA Rent A Car',
          heading: `أهلاً ${name}`,
          line1: 'شكراً لإنشاء حسابك. يمكنك الآن استكشاف أسطولنا وحجز سيارة في أي وقت.',
          line2: 'لإتمام التحقق، يرجى رفع وثائقك من صفحة حسابك.',
        }
      : {
          preview: 'Welcome to AA Rent A Car',
          heading: `Welcome, ${name}`,
          line1: 'Thanks for creating your account. You can now browse our fleet and book a car anytime.',
          line2: 'To finish verification, please upload your documents from your account page.',
        };
  return (
    <BrandLayout locale={locale} preview={t.preview} heading={t.heading}>
      <Para locale={locale}>{t.line1}</Para>
      <Para locale={locale}>{t.line2}</Para>
    </BrandLayout>
  );
}
