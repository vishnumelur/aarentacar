import Link from 'next/link';
import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { promoCodes } from '@/db/schema';
import { PromoForm, type PromoFormValues } from '@/components/manager/promo-form';
import { promoUsageStats, setPromoActiveForm } from '@/lib/actions/promos';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

function toDateInput(d: Date | null): string | null {
  if (!d) return null;
  return new Date(d).toISOString().slice(0, 10);
}

export default async function PromoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [promo] = await db.select().from(promoCodes).where(eq(promoCodes.id, id)).limit(1);
  if (!promo) notFound();

  const stats = await promoUsageStats(promo.code);

  const initial: PromoFormValues = {
    id: promo.id,
    code: promo.code,
    kind: promo.kind,
    value: promo.value,
    minAmountAed: promo.minAmountAed,
    maxUses: promo.maxUses,
    validFrom: toDateInput(promo.validFrom) ?? '',
    validTo: toDateInput(promo.validTo),
    appliesToCategories: promo.appliesToCategories ?? null,
    active: promo.active,
  };

  return (
    <div className="space-y-6">
      <Link href="/manager/promos" className="text-sm text-primary underline">
        ← All promos
      </Link>

      <div className="flex items-baseline justify-between">
        <h1 className="font-mono text-2xl font-semibold">{promo.code}</h1>
        <form action={setPromoActiveForm}>
          <input type="hidden" name="id" value={promo.id} />
          <input type="hidden" name="active" value={promo.active ? 'false' : 'true'} />
          <Button type="submit" variant={promo.active ? 'destructive' : 'default'} size="sm">
            {promo.active ? 'Deactivate' : 'Activate'}
          </Button>
        </form>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Bookings used" value={String(stats.bookingsUsed)} />
        <Stat label="Reserved uses" value={`${promo.usedCount}${promo.maxUses ? ` / ${promo.maxUses}` : ''}`} />
        <Stat label="Total discount" value={`AED ${stats.totalDiscountAed.toLocaleString()}`} />
      </div>

      <PromoForm initial={initial} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}
