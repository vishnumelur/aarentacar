import * as React from 'react';
import { render } from '@react-email/components';
import type { MailLocale, TemplateName, TemplatePayloads } from './templates/types';
import { isTemplateName } from './templates/types';
import { WelcomeEmail } from './templates/welcome';
import { KycApprovedEmail } from './templates/kyc-approved';
import { KycRejectedEmail } from './templates/kyc-rejected';
import { BookingConfirmedEmail } from './templates/booking-confirmed';
import { PaymentReceiptEmail } from './templates/payment-receipt';
import { DriverDispatchedEmail } from './templates/driver-dispatched';
import { ReturnReminderEmail } from './templates/return-reminder';
import { PasswordResetEmail } from './templates/password-reset';

/**
 * Server-side template renderer (Plan #12, Task 7/8). Maps a template name +
 * locale + payload to a React Email element, renders it to HTML, and computes
 * the matching subject line. Node runtime only — never import from a client
 * component.
 */

type ElementFor = <T extends TemplateName>(
  locale: MailLocale,
  payload: TemplatePayloads[T],
) => React.ReactElement;

const COMPONENTS: { [K in TemplateName]: ElementFor } = {
  welcome: (locale, p) => <WelcomeEmail locale={locale} {...(p as TemplatePayloads['welcome'])} />,
  'kyc-approved': (locale, p) => (
    <KycApprovedEmail locale={locale} {...(p as TemplatePayloads['kyc-approved'])} />
  ),
  'kyc-rejected': (locale, p) => (
    <KycRejectedEmail locale={locale} {...(p as TemplatePayloads['kyc-rejected'])} />
  ),
  'booking-confirmed': (locale, p) => (
    <BookingConfirmedEmail locale={locale} {...(p as TemplatePayloads['booking-confirmed'])} />
  ),
  'payment-receipt': (locale, p) => (
    <PaymentReceiptEmail locale={locale} {...(p as TemplatePayloads['payment-receipt'])} />
  ),
  'driver-dispatched': (locale, p) => (
    <DriverDispatchedEmail locale={locale} {...(p as TemplatePayloads['driver-dispatched'])} />
  ),
  'return-reminder': (locale, p) => (
    <ReturnReminderEmail locale={locale} {...(p as TemplatePayloads['return-reminder'])} />
  ),
  'password-reset': (locale, p) => (
    <PasswordResetEmail locale={locale} {...(p as TemplatePayloads['password-reset'])} />
  ),
};

/** Localized subject line per template. Pure + synchronous (unit-tested). */
export function subjectFor<T extends TemplateName>(
  template: T,
  locale: MailLocale,
  payload: TemplatePayloads[T],
): string {
  const ar = locale === 'ar';
  switch (template) {
    case 'welcome':
      return ar ? 'مرحباً بك في AA Rent A Car' : 'Welcome to AA Rent A Car';
    case 'kyc-approved':
      return ar ? 'تمت الموافقة على وثائقك' : 'Your documents were approved';
    case 'kyc-rejected':
      return ar ? 'وثائقك تتطلب إجراءً' : 'Action needed on your documents';
    case 'booking-confirmed': {
      const code = (payload as TemplatePayloads['booking-confirmed']).bookingCode;
      return ar ? `تم تأكيد الحجز ${code}` : `Booking ${code} confirmed`;
    }
    case 'payment-receipt': {
      const code = (payload as TemplatePayloads['payment-receipt']).bookingCode;
      return ar ? `إيصال الدفع للحجز ${code}` : `Payment receipt — booking ${code}`;
    }
    case 'driver-dispatched': {
      const code = (payload as TemplatePayloads['driver-dispatched']).bookingCode;
      return ar ? `سائقك في الطريق — ${code}` : `Your driver is on the way — ${code}`;
    }
    case 'return-reminder': {
      const code = (payload as TemplatePayloads['return-reminder']).bookingCode;
      return ar ? `تذكير بإرجاع المركبة — ${code}` : `Return reminder — booking ${code}`;
    }
    case 'password-reset':
      return ar ? 'تمت إعادة تعيين كلمة المرور' : 'Your password was reset';
    default:
      return 'AA Rent A Car';
  }
}

/** Render a template to HTML. Throws on an unknown template name. */
export async function renderTemplate<T extends TemplateName>(
  template: T,
  locale: MailLocale,
  payload: TemplatePayloads[T],
): Promise<string> {
  if (!isTemplateName(template)) {
    throw new Error(`unknown mail template: ${template}`);
  }
  const element = COMPONENTS[template](locale, payload);
  return render(element);
}

/** Render a template to a plain-text fallback (for multipart emails). */
export async function renderTemplateText<T extends TemplateName>(
  template: T,
  locale: MailLocale,
  payload: TemplatePayloads[T],
): Promise<string> {
  const element = COMPONENTS[template](locale, payload);
  return render(element, { plainText: true });
}

export type { TemplateName, TemplatePayloads, MailLocale };
