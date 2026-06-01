import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { customerProfiles } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { ProfileForm } from '@/components/customer/profile-form';

export default async function CustomerProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'customer') redirect('/');

  const [profile] = await db
    .select()
    .from(customerProfiles)
    .where(eq(customerProfiles.userId, user.id))
    .limit(1);

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold">Profile</h1>
        <p className="text-sm text-muted-foreground">
          {profile
            ? 'Update your travel profile. Required before verification.'
            : 'Complete your profile to begin verification.'}
        </p>
      </div>
      <ProfileForm initial={profile ?? null} />
    </main>
  );
}
