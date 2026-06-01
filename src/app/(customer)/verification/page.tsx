import Link from 'next/link';
import { redirect } from 'next/navigation';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { customerProfiles, customerDocuments } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { VerificationStatusCard } from '@/components/customer/verification-status-card';
import { DocumentUploader } from '@/components/customer/document-uploader';
import { Button } from '@/components/ui/button';

type DocType =
  | 'passport'
  | 'visa'
  | 'emirates_id_front'
  | 'emirates_id_back'
  | 'driving_license_front'
  | 'driving_license_back'
  | 'international_permit';

const LABELS: Record<DocType, string> = {
  passport: 'Passport',
  visa: 'UAE Visa / Entry Stamp',
  emirates_id_front: 'Emirates ID (front)',
  emirates_id_back: 'Emirates ID (back)',
  driving_license_front: 'Driving License (front)',
  driving_license_back: 'Driving License (back)',
  international_permit: 'International Driving Permit',
};

const NEEDS_EXPIRY: DocType[] = [
  'passport',
  'visa',
  'emirates_id_front',
  'driving_license_front',
  'international_permit',
];

const TOURIST_REQUIRED: DocType[] = [
  'passport',
  'visa',
  'driving_license_front',
  'driving_license_back',
];

const RESIDENT_REQUIRED: DocType[] = [
  'emirates_id_front',
  'emirates_id_back',
  'driving_license_front',
  'driving_license_back',
];

export default async function VerificationPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'customer') redirect('/');

  const [profile] = await db
    .select()
    .from(customerProfiles)
    .where(eq(customerProfiles.userId, user.id))
    .limit(1);

  if (!profile) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-12 space-y-6">
        <h1 className="text-2xl font-semibold">Verification Center</h1>
        <p className="text-muted-foreground">
          Before uploading documents, please complete your travel profile.
        </p>
        <Link href="/profile">
          <Button>Go to profile</Button>
        </Link>
      </main>
    );
  }

  const docs = await db
    .select()
    .from(customerDocuments)
    .where(eq(customerDocuments.customerId, user.id))
    .orderBy(desc(customerDocuments.uploadedAt));

  const required: DocType[] =
    profile.residency === 'tourist' ? TOURIST_REQUIRED : RESIDENT_REQUIRED;

  return (
    <main className="mx-auto max-w-3xl px-6 py-12 space-y-6">
      <h1 className="text-2xl font-semibold">Verification Center</h1>
      <VerificationStatusCard user={user} docs={docs} />

      {required.map((type) => {
        const current =
          docs.find((d) => d.type === type && d.status === 'pending') ??
          docs.find((d) => d.type === type && d.status === 'approved') ??
          docs.find((d) => d.type === type && d.status === 'rejected');
        return (
          <section key={type} className="rounded-lg border bg-card p-6 space-y-3">
            <div className="flex items-baseline justify-between">
              <h3 className="font-medium">{LABELS[type]}</h3>
              {current && (
                <span
                  className={`rounded px-2 py-0.5 text-xs ${
                    current.status === 'approved'
                      ? 'bg-green-100 text-green-900'
                      : current.status === 'rejected'
                        ? 'bg-destructive/10 text-destructive'
                        : 'bg-muted'
                  }`}
                >
                  {current.status}
                </span>
              )}
            </div>
            {current?.status === 'rejected' && current.reviewNote && (
              <p className="text-sm text-destructive">
                Manager note: {current.reviewNote}
              </p>
            )}
            {(!current || current.status === 'rejected') && (
              <DocumentUploader type={type} requireExpiry={NEEDS_EXPIRY.includes(type)} />
            )}
            {current?.status === 'pending' && (
              <p className="text-sm text-muted-foreground">
                Uploaded {new Date(current.uploadedAt).toLocaleString()}. Awaiting review.
              </p>
            )}
            {current?.status === 'approved' && (
              <p className="text-sm text-muted-foreground">
                Approved
                {current.reviewedAt
                  ? ` ${new Date(current.reviewedAt).toLocaleDateString()}`
                  : ''}
                {current.expiryDate ? ` · expires ${current.expiryDate}` : ''}
              </p>
            )}
          </section>
        );
      })}
    </main>
  );
}
