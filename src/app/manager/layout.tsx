import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { canAccessPortal } from '@/lib/auth/roles';
import { ManagerShell } from '@/components/manager/shell';

export default async function ManagerLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!canAccessPortal(user.role, 'manager')) redirect('/');
  return <ManagerShell user={user}>{children}</ManagerShell>;
}
