import type { User, CustomerDocument } from '@/db/schema';

const COPY: Record<User['verificationStatus'], { title: string; body: string; tone: string }> = {
  unverified: {
    title: 'Verification required',
    body: 'Upload your documents below to begin verification. Once approved, you can book any vehicle.',
    tone: 'bg-muted text-foreground',
  },
  pending: {
    title: 'Documents under review',
    body: 'Our team is reviewing your documents. We\'ll email you when it\'s done — usually within 1 business hour.',
    tone: 'bg-amber-100 text-amber-900',
  },
  verified: {
    title: 'Verified ✓',
    body: 'You\'re all set. You can browse and book any vehicle now.',
    tone: 'bg-green-100 text-green-900',
  },
  rejected: {
    title: 'Verification rejected',
    body: 'See per-document notes below and re-upload any rejected items.',
    tone: 'bg-destructive/10 text-destructive',
  },
};

export function VerificationStatusCard({
  user,
  docs: _docs,
}: {
  user: User;
  docs: CustomerDocument[];
}) {
  const copy = COPY[user.verificationStatus];
  return (
    <div className={`rounded-lg p-6 ${copy.tone}`}>
      <h2 className="text-lg font-semibold">{copy.title}</h2>
      <p className="mt-1 text-sm">{copy.body}</p>
    </div>
  );
}
