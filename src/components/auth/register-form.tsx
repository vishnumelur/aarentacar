'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function RegisterForm() {
  const t = useTranslations('Auth');
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: fd.get('email'),
        password: fd.get('password'),
        fullName: fd.get('fullName'),
        phone: fd.get('phone') || undefined,
      }),
    });
    setLoading(false);
    if (res.status === 409) {
      setError(t('emailTaken'));
      return;
    }
    if (!res.ok) {
      setError(t('generic'));
      return;
    }
    router.push('/dashboard');
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="fullName">{t('fullName')}</Label>
        <Input id="fullName" name="fullName" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">{t('email')}</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone">{t('phone')}</Label>
        <Input id="phone" name="phone" type="tel" autoComplete="tel" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">{t('password')}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={12}
          required
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? t('submitting') : t('registerCta')}
      </Button>
    </form>
  );
}
