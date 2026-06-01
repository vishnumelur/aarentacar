import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { canAccessPortal } from '@/lib/auth/roles';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!canAccessPortal(user.role, 'superadmin')) redirect('/');
  return <>{children}</>;
}
