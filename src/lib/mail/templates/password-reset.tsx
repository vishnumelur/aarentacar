import * as React from 'react';
import { BrandLayout, Para, type MailLocale } from './layout';
import type { TemplatePayloads } from './types';

export function PasswordResetEmail({
  locale,
  name,
  tempPassword,
}: { locale: MailLocale } & TemplatePayloads['password-reset']): React.ReactElement {
  const t =
    locale === 'ar'
      ? {
          preview: 'تمت إعادة تعيين كلمة المرور',
          heading: 'كلمة مرور مؤقتة',
          line1: `مرحباً ${name}، تمت إعادة تعيين كلمة مرورك.`,
          passLabel: 'كلمة المرور المؤقتة:',
          line2: 'سجّل الدخول بهذه الكلمة ثم غيّرها فوراً من إعدادات حسابك.',
        }
      : {
          preview: 'Your password was reset',
          heading: 'Temporary password',
          line1: `Hi ${name}, your password has been reset.`,
          passLabel: 'Temporary password:',
          line2: 'Sign in with this password, then change it right away from your account settings.',
        };
  return (
    <BrandLayout locale={locale} preview={t.preview} heading={t.heading}>
      <Para locale={locale}>{t.line1}</Para>
      <Para locale={locale}>
        <strong>{t.passLabel}</strong> <code>{tempPassword}</code>
      </Para>
      <Para locale={locale}>{t.line2}</Para>
    </BrandLayout>
  );
}
