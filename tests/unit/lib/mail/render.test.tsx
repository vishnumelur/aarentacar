import { describe, it, expect } from 'vitest';
import { renderTemplate, renderTemplateText, subjectFor } from '@/lib/mail/render';
import { TEMPLATE_NAMES, type TemplatePayloads } from '@/lib/mail/templates/types';

/**
 * Template renderer tests (Plan #12). Asserts HTML + subject per template and
 * locale (en + ar), plus RTL direction for Arabic. No DB / SMTP touched.
 */

const PAYLOADS: TemplatePayloads = {
  welcome: { name: 'Sara' },
  'kyc-approved': { name: 'Sara' },
  'kyc-rejected': { name: 'Sara', reason: 'Blurry photo' },
  'booking-confirmed': { name: 'Sara', bookingCode: 'AA-1001', pickupAt: '2026-06-10T09:00:00Z', totalAed: 450 },
  'payment-receipt': { name: 'Sara', bookingCode: 'AA-1001', amountAed: 450 },
  'driver-dispatched': { name: 'Sara', bookingCode: 'AA-1001', driverName: 'Omar', pickupAt: '2026-06-10T09:00:00Z' },
  'return-reminder': { name: 'Sara', bookingCode: 'AA-1001', returnAt: '2026-06-12T09:00:00Z' },
  'password-reset': { name: 'Sara', tempPassword: 'abc123XYZ' },
};

describe('renderTemplate', () => {
  it('renders every template for en + ar to non-empty HTML containing the brand', async () => {
    for (const name of TEMPLATE_NAMES) {
      for (const locale of ['en', 'ar'] as const) {
        const html = await renderTemplate(name, locale, PAYLOADS[name] as never);
        expect(html.length).toBeGreaterThan(100);
        expect(html).toContain('AA Rent A Car');
      }
    }
  });

  it('sets dir="rtl" + lang="ar" for Arabic, dir="ltr" for English', async () => {
    const ar = await renderTemplate('welcome', 'ar', PAYLOADS.welcome);
    expect(ar).toMatch(/dir="rtl"/);
    expect(ar).toMatch(/lang="ar"/);
    const en = await renderTemplate('welcome', 'en', PAYLOADS.welcome);
    expect(en).toMatch(/dir="ltr"/);
    expect(en).toMatch(/lang="en"/);
  });

  it('interpolates payload fields into the HTML', async () => {
    const en = await renderTemplate('booking-confirmed', 'en', PAYLOADS['booking-confirmed']);
    expect(en).toContain('AA-1001');
    expect(en).toContain('Sara');
    expect(en).toContain('450');

    const rej = await renderTemplate('kyc-rejected', 'en', PAYLOADS['kyc-rejected']);
    expect(rej).toContain('Blurry photo');

    const pw = await renderTemplate('password-reset', 'en', PAYLOADS['password-reset']);
    expect(pw).toContain('abc123XYZ');
  });

  it('contains localized body copy (en vs ar differ)', async () => {
    const en = await renderTemplate('kyc-approved', 'en', PAYLOADS['kyc-approved']);
    const ar = await renderTemplate('kyc-approved', 'ar', PAYLOADS['kyc-approved']);
    expect(en).toContain('verified');
    expect(ar).toContain('التحقق');
    expect(en).not.toEqual(ar);
  });

  it('throws on an unknown template name', async () => {
    await expect(
      // @ts-expect-error — intentionally invalid template
      renderTemplate('does-not-exist', 'en', {}),
    ).rejects.toThrow(/unknown mail template/);
  });
});

describe('renderTemplateText', () => {
  it('produces a plain-text variant without HTML tags', async () => {
    const text = await renderTemplateText('welcome', 'en', PAYLOADS.welcome);
    expect(text).toContain('AA Rent A Car');
    expect(text).not.toMatch(/<html/i);
  });
});

describe('subjectFor', () => {
  it('returns a localized subject per template (en + ar)', () => {
    expect(subjectFor('welcome', 'en', PAYLOADS.welcome)).toBe('Welcome to AA Rent A Car');
    expect(subjectFor('welcome', 'ar', PAYLOADS.welcome)).toBe('مرحباً بك في AA Rent A Car');

    expect(subjectFor('kyc-approved', 'en', PAYLOADS['kyc-approved'])).toMatch(/approved/);
    expect(subjectFor('kyc-rejected', 'en', PAYLOADS['kyc-rejected'])).toMatch(/Action needed/);
  });

  it('embeds the booking code in code-bearing subjects', () => {
    expect(subjectFor('booking-confirmed', 'en', PAYLOADS['booking-confirmed'])).toContain('AA-1001');
    expect(subjectFor('payment-receipt', 'en', PAYLOADS['payment-receipt'])).toContain('AA-1001');
    expect(subjectFor('driver-dispatched', 'en', PAYLOADS['driver-dispatched'])).toContain('AA-1001');
    expect(subjectFor('return-reminder', 'ar', PAYLOADS['return-reminder'])).toContain('AA-1001');
  });

  it('has a subject for every template name', () => {
    for (const name of TEMPLATE_NAMES) {
      const s = subjectFor(name, 'en', PAYLOADS[name] as never);
      expect(s.length).toBeGreaterThan(0);
      expect(s).not.toBe('AA Rent A Car'); // not the fallback
    }
  });
});
