import type { ReactNode } from 'react';

export function PortalShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="min-h-screen">
      <header className="border-b bg-primary px-6 py-3 text-primary-foreground">
        <div className="text-lg font-semibold">{title}</div>
      </header>
      <section className="p-6">{children}</section>
    </main>
  );
}
