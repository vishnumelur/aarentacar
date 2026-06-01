import { desc, eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { db } from '@/db';
import { users, customerProfiles, customerDocuments } from '@/db/schema';
import { presignCustomerDocumentGet } from '@/lib/storage/presign';
import { DocumentReviewCard } from '@/components/manager/document-review-card';

export default async function ManagerCustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [customer] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!customer || customer.role !== 'customer') notFound();

  const [profile] = await db
    .select()
    .from(customerProfiles)
    .where(eq(customerProfiles.userId, id))
    .limit(1);

  const docs = await db
    .select()
    .from(customerDocuments)
    .where(eq(customerDocuments.customerId, id))
    .orderBy(desc(customerDocuments.uploadedAt));

  const docsWithUrls = await Promise.all(
    docs.map(async (d) => ({ doc: d, signedUrl: await presignCustomerDocumentGet(d.fileUrl) })),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{customer.fullName}</h1>
        <p className="text-sm text-muted-foreground">{customer.email}</p>
      </div>

      <div className="rounded-lg border bg-card p-4 text-sm">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Verification">
            <span
              className={`rounded px-2 py-0.5 text-xs ${
                customer.verificationStatus === 'verified'
                  ? 'bg-green-100 text-green-900'
                  : customer.verificationStatus === 'pending'
                    ? 'bg-amber-100 text-amber-900'
                    : customer.verificationStatus === 'rejected'
                      ? 'bg-destructive/10 text-destructive'
                      : 'bg-muted'
              }`}
            >
              {customer.verificationStatus}
            </span>
          </Field>
          <Field label="Residency">{profile?.residency ?? '—'}</Field>
          <Field label="Date of birth">{profile?.dateOfBirth ?? '—'}</Field>
          <Field label="Nationality">{profile?.nationality ?? '—'}</Field>
        </div>
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">Documents</h2>
        {docsWithUrls.length === 0 && (
          <p className="rounded-lg border bg-card p-6 text-center text-muted-foreground">
            No documents uploaded yet.
          </p>
        )}
        {docsWithUrls.map(({ doc, signedUrl }) => (
          <DocumentReviewCard key={doc.id} doc={doc} signedUrl={signedUrl} />
        ))}
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-medium">{children}</div>
    </div>
  );
}
