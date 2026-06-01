import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AA Rent A Car',
  description: 'Premium car and limousine rentals in Dubai.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground antialiased">{children}</body>
    </html>
  );
}
