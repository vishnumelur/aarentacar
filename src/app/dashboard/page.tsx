import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { PortalShell } from '@/components/portal-shell';

export default async function CustomerDashboard() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return (
    <PortalShell title={`Welcome, ${user.fullName}`}>
      <p className="text-muted-foreground">Your bookings live here — built in Plan #4.</p>
    </PortalShell>
  );
}
