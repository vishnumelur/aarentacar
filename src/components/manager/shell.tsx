import type { ReactNode } from 'react';
import Link from 'next/link';
import { ManagerNav } from './nav';

export function ManagerShell({
  user,
  children,
}: {
  user: { fullName: string; role: string };
  children: ReactNode;
}) {
  return (
    <div className="grid min-h-screen grid-cols-[240px_1fr]">
      <aside className="border-r bg-card">
        <div className="border-b px-4 py-4">
          <Link href="/manager" className="text-lg font-semibold text-primary">
            AA Manager
          </Link>
        </div>
        <ManagerNav />
      </aside>
      <div className="flex flex-col">
        <header className="flex items-center justify-between border-b px-6 py-3">
          <div className="text-sm text-muted-foreground">Manager Portal</div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground capitalize">{user.role}</span>
            <span className="font-medium">{user.fullName}</span>
          </div>
        </header>
        <section className="flex-1 p-6">{children}</section>
      </div>
    </div>
  );
}
