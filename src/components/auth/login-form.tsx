'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const ROLE_REDIRECT: Record<string, string> = {
  customer: '/dashboard',
  manager: '/manager',
  agent: '/manager',
  driver: '/driver',
  superadmin: '/admin',
};

export function LoginForm() {
  const t = useTranslations('Auth');
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: fd.get('email'), password: fd.get('password') }),
    });
    setLoading(false);
    if (!res.ok) {
      setError(res.status === 401 ? t('invalidCredentials') : t('generic'));
      return;
    }
    const { user } = (await res.json()) as { user: { role: string } };
    router.push(ROLE_REDIRECT[user.role] ?? '/');
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">{t('email')}</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">{t('password')}</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? t('submitting') : t('loginCta')}
      </Button>
    </form>
  );
}
