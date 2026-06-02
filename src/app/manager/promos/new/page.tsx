import Link from 'next/link';
import { PromoForm } from '@/components/manager/promo-form';

export default function NewPromoPage() {
  return (
    <div className="space-y-6">
      <Link href="/manager/promos" className="text-sm text-primary underline">
        ← All promos
      </Link>
      <h1 className="text-2xl font-semibold">New promo</h1>
      <PromoForm />
    </div>
  );
}
