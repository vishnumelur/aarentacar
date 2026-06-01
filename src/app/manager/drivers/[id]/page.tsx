import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { users, driverProfiles } from '@/db/schema';
import { DriverForm } from '@/components/manager/driver-form';
import { DriverStatusToggle } from '@/components/manager/driver-status-toggle';

export default async function EditDriverPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!user || user.role !== 'driver') notFound();
  const [profile] = await db.select().from(driverProfiles).where(eq(driverProfiles.userId, id)).limit(1);
  if (!profile) notFound();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{user.fullName}</h1>
        <p className="text-sm text-muted-foreground">{user.email}</p>
      </div>

      <DriverStatusToggle userId={user.id} currentStatus={profile.status} />

      <DriverForm
        mode="edit"
        initial={{
          userId: user.id,
          fullName: user.fullName,
          phone: user.phone ?? '',
          licenseNo: profile.licenseNo,
          licenseExpiry: profile.licenseExpiry,
        }}
      />
    </div>
  );
}
