'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const LINKS: Array<{ href: string; label: string }> = [
  { href: '/admin', label: 'Health' },
  { href: '/admin/feature-flags', label: 'Feature Flags' },
  { href: '/admin/audit-logs', label: 'Audit Logs' },
  { href: '/admin/jobs', label: 'Jobs' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/credentials', label: 'Credentials' },
  { href: '/admin/security/setup-2fa', label: '2FA' },
  { href: '/admin/danger', label: 'Danger Zone' },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap gap-1 border-b bg-muted/40 px-6 py-2">
      {LINKS.map((l) => {
        const active = l.href === '/admin' ? pathname === '/admin' : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={cn(
              'rounded px-3 py-1.5 text-sm font-medium transition-colors',
              active
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              l.href === '/admin/danger' && !active && 'text-destructive',
            )}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
