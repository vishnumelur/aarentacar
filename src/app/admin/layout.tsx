import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { canAccessPortal } from '@/lib/auth/roles';
import { AdminNav } from '@/components/admin/admin-nav';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!canAccessPortal(user.role, 'superadmin')) redirect('/');
  return (
    <div className="min-h-screen">
      <header className="bg-primary text-primary-foreground border-b px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="text-lg font-semibold">AA Rent A Car · Super-Admin</div>
          <div className="text-sm opacity-80">{user.email}</div>
        </div>
      </header>
      <AdminNav />
      {children}
    </div>
  );
}
