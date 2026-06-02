'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function logout() {
    setPending(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      router.push('/login');
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      onClick={logout}
      disabled={pending}
      className="rounded px-2 py-1 text-sm text-primary-foreground/90 underline-offset-2 hover:underline disabled:opacity-60"
    >
      {pending ? 'Signing out…' : 'Sign out'}
    </button>
  );
}
