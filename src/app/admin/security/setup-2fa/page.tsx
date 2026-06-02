import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { AdminPage } from '@/components/admin/admin-page';
import { isTotpEnabled } from '@/lib/totp/store';
import { Setup2faPanel } from '@/components/admin/setup-2fa-panel';

export const dynamic = 'force-dynamic';

export default async function Setup2faPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'superadmin') redirect('/login');
  const enabled = await isTotpEnabled(user.id);

  return (
    <AdminPage title="Two-Factor Authentication">
      <div className="max-w-xl">
        <p className="text-muted-foreground mb-6 text-sm">
          Super-admin accounts must use an authenticator app (TOTP). Once enabled,
          you will be prompted for a 6-digit code at every login.
        </p>
        <Setup2faPanel enabled={enabled} />
      </div>
    </AdminPage>
  );
}
