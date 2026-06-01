import type { Metadata, Viewport } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { Inter, Cairo } from 'next/font/google';
import { SwRegister } from '@/components/sw-register';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });
const cairo = Cairo({ subsets: ['arabic'], variable: '--font-arabic' });

export const metadata: Metadata = {
  title: 'AA Rent A Car',
  description: 'Premium car and limousine rentals in Dubai.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    title: 'AA Driver',
    statusBarStyle: 'default',
  },
  other: {
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-title': 'AA Driver',
  },
};

export const viewport: Viewport = {
  themeColor: '#dc2626',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();
  const dir = locale === 'ar' ? 'rtl' : 'ltr';

  return (
    <html lang={locale} dir={dir} className={`${inter.variable} ${cairo.variable}`}>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <NextIntlClientProvider messages={messages} locale={locale}>
          <SwRegister />
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
