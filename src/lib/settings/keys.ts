/**
 * Canonical setting keys + their default values. The `settings` table is a
 * key/value store (jsonb `value`); these helpers centralize the shapes so the
 * settings page, the public landing page, and cancellation/deposit logic stay
 * in sync.
 */
import { DEFAULT_CANCELLATION_POLICY, type CancellationPolicy } from '@/lib/payments/cancellation';

export interface BusinessHours {
  /** 0=Sunday … 6=Saturday → "09:00" / "18:00", or null when closed. */
  open: string | null;
  close: string | null;
}

export interface BankAccountDetails {
  bankName: string;
  accountName: string;
  accountNumber: string;
  iban: string;
  swift: string;
}

export interface EmailTemplate {
  subject: string;
  body: string;
}

export const SETTING_KEYS = {
  businessHours: 'business_hours',
  defaultDeposits: 'default_deposits',
  cancellationPolicy: 'cancellation_policy',
  languagesEnabled: 'languages_enabled',
  bankAccount: 'bank_account',
  emailTemplates: 'email_templates',
} as const;

export const DEFAULT_BUSINESS_HOURS: BusinessHours = { open: '09:00', close: '21:00' };

export const DEFAULT_BANK_ACCOUNT: BankAccountDetails = {
  bankName: '',
  accountName: 'AA Rent A Car LLC',
  accountNumber: '',
  iban: '',
  swift: '',
};

export const DEFAULT_LANGUAGES_ENABLED: ('en' | 'ar')[] = ['en', 'ar'];

export const DEFAULT_EMAIL_TEMPLATES: Record<string, EmailTemplate> = {
  booking_confirmed: {
    subject: 'Your AA Rent A Car booking {{code}} is confirmed',
    body: 'Hi {{name}}, your booking {{code}} is confirmed. Pickup: {{pickupAt}}.',
  },
};

export { DEFAULT_CANCELLATION_POLICY };
export type { CancellationPolicy };
