import type { MailLocale } from './layout';

/**
 * Typed payloads per template (Plan #12). The `send-email` job carries
 * `{ to, templateName, locale, payload }`; this map keeps the renderer and the
 * enqueue call-sites honest about which fields each template needs.
 */
export interface TemplatePayloads {
  welcome: { name: string };
  'kyc-approved': { name: string };
  'kyc-rejected': { name: string; reason: string };
  'booking-confirmed': { name: string; bookingCode: string; pickupAt: string; totalAed: number };
  'payment-receipt': { name: string; bookingCode: string; amountAed: number };
  'driver-dispatched': { name: string; bookingCode: string; driverName: string; pickupAt: string };
  'return-reminder': { name: string; bookingCode: string; returnAt: string };
  'password-reset': { name: string; tempPassword: string };
}

export type TemplateName = keyof TemplatePayloads;

export const TEMPLATE_NAMES: TemplateName[] = [
  'welcome',
  'kyc-approved',
  'kyc-rejected',
  'booking-confirmed',
  'payment-receipt',
  'driver-dispatched',
  'return-reminder',
  'password-reset',
];

export function isTemplateName(name: string): name is TemplateName {
  return (TEMPLATE_NAMES as string[]).includes(name);
}

export type { MailLocale };
