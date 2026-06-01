'use client';

import { useLocale } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';
import { useTransition } from 'react';
import { Button } from '@/components/ui/button';

export function LanguageToggle() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const next = locale === 'en' ? 'ar' : 'en';

  function toggle() {
    startTransition(() => {
      document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=${60 * 60 * 24 * 365}`;
      router.replace(pathname);
      router.refresh();
    });
  }

  return (
    <Button variant="ghost" size="sm" onClick={toggle} disabled={isPending}>
      {next === 'ar' ? 'العربية' : 'English'}
    </Button>
  );
}
