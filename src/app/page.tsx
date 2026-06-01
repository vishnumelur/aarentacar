import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { LanguageToggle } from '@/components/language-toggle';

export default function LandingPage() {
  const t = useTranslations('Brand');
  const tNav = useTranslations('Nav');
  const tLanding = useTranslations('Landing');

  return (
    <main className="min-h-screen">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <div className="text-xl font-bold text-primary">{t('name')}</div>
        <nav className="flex items-center gap-2">
          <Link href="/login">
            <Button variant="ghost">{tNav('login')}</Button>
          </Link>
          <Link href="/register">
            <Button>{tNav('register')}</Button>
          </Link>
          <LanguageToggle />
        </nav>
      </header>

      <section className="mx-auto max-w-5xl px-6 py-24 text-center">
        <h1 className="text-5xl font-bold tracking-tight">{t('name')}</h1>
        <p className="mt-4 text-xl text-muted-foreground">{t('tagline')}</p>
        <Card className="mt-12">
          <CardContent className="p-8 text-muted-foreground">
            {tLanding('bookingPlaceholder')}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
