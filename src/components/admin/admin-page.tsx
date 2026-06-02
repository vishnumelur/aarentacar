import type { ReactNode } from 'react';

/** Content wrapper for admin pages. The portal chrome (header + nav) lives in
 *  the admin layout, so pages only render their title + body here. */
export function AdminPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="p-6">
      <h1 className="mb-6 text-2xl font-semibold">{title}</h1>
      {children}
    </section>
  );
}
