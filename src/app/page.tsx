import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { LanguageToggle } from '@/components/language-toggle';
import { SearchWidget } from '@/components/public/search-widget';

export default function LandingPage() {
  const t = useTranslations('Brand');
  const tNav = useTranslations('Nav');

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

      <section className="mx-auto max-w-5xl px-6 py-16 text-center">
        <h1 className="text-5xl font-bold tracking-tight">{t('name')}</h1>
        <p className="mt-4 text-xl text-muted-foreground">{t('tagline')}</p>
        <div className="mt-12 text-left">
          <SearchWidget />
        </div>
      </section>

      <section className="border-t bg-muted/30 px-6 py-12">
        <div className="mx-auto max-w-5xl grid gap-6 md:grid-cols-3">
          <Feature title="500+ vehicles" body="Economy to luxury. Plus dedicated limousine fleet." />
          <Feature title="Delivered anywhere" body="Car drop-off and pickup anywhere in Dubai." />
          <Feature title="With or without driver" body="Self-drive or chauffeur — your choice." />
        </div>
      </section>
    </main>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border bg-card p-6">
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
