import * as React from 'react';
import { Body, Container, Head, Heading, Hr, Html, Preview, Section, Text } from '@react-email/components';

export type MailLocale = 'en' | 'ar';

export interface BrandLayoutProps {
  locale: MailLocale;
  preview: string;
  heading: string;
  children: React.ReactNode;
}

/**
 * Shared branded shell for every transactional email (Plan #12, Task 7).
 *
 * Bilingual + RTL aware: when `locale === 'ar'` the document direction flips to
 * rtl and the body text aligns right. Uses inline styles (not Tailwind) so the
 * rendered HTML is self-contained and survives email-client CSS stripping.
 */
export function BrandLayout({ locale, preview, heading, children }: BrandLayoutProps): React.ReactElement {
  const dir = locale === 'ar' ? 'rtl' : 'ltr';
  const align = locale === 'ar' ? 'right' : 'left';
  return (
    <Html lang={locale} dir={dir}>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: '#f4f4f5', margin: 0, padding: '24px 0', fontFamily: 'Arial, Helvetica, sans-serif' }}>
        <Container style={{ backgroundColor: '#ffffff', borderRadius: 8, maxWidth: 560, margin: '0 auto', padding: 0, overflow: 'hidden' }}>
          <Section style={{ backgroundColor: '#dc2626', padding: '20px 32px' }}>
            <Text style={{ color: '#ffffff', fontSize: 20, fontWeight: 'bold', margin: 0, textAlign: align as 'left' | 'right' }}>
              AA Rent A Car
            </Text>
          </Section>
          <Section style={{ padding: '32px' }}>
            <Heading as="h1" style={{ fontSize: 22, color: '#0a0a0b', margin: '0 0 16px', textAlign: align as 'left' | 'right' }}>
              {heading}
            </Heading>
            {children}
          </Section>
          <Hr style={{ borderColor: '#e4e4e7', margin: 0 }} />
          <Section style={{ padding: '20px 32px' }}>
            <Text style={{ color: '#71717a', fontSize: 12, margin: 0, textAlign: align as 'left' | 'right' }}>
              {locale === 'ar'
                ? 'هذه رسالة آلية من AA Rent A Car. لا داعي للرد عليها.'
                : 'This is an automated message from AA Rent A Car. No need to reply.'}
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

/** A body paragraph that respects locale alignment. */
export function Para({ locale, children }: { locale: MailLocale; children: React.ReactNode }): React.ReactElement {
  const align = locale === 'ar' ? 'right' : 'left';
  return (
    <Text style={{ color: '#3f3f46', fontSize: 15, lineHeight: '24px', margin: '0 0 12px', textAlign: align as 'left' | 'right' }}>
      {children}
    </Text>
  );
}
