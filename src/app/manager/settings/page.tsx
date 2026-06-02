import Link from 'next/link';
import { asc } from 'drizzle-orm';
import { db } from '@/db';
import { vehicleCategories } from '@/db/schema';
import { readSettings } from '@/lib/settings/read';
import {
  SETTING_KEYS,
  DEFAULT_BUSINESS_HOURS,
  DEFAULT_BANK_ACCOUNT,
  DEFAULT_LANGUAGES_ENABLED,
  DEFAULT_CANCELLATION_POLICY,
  DEFAULT_EMAIL_TEMPLATES,
  type BusinessHours,
  type BankAccountDetails,
  type CancellationPolicy,
  type EmailTemplate,
} from '@/lib/settings/keys';
import { SettingsTabs } from '@/components/manager/settings-tabs';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const [values, categories] = await Promise.all([
    readSettings(Object.values(SETTING_KEYS)),
    db.select().from(vehicleCategories).orderBy(asc(vehicleCategories.sortOrder)),
  ]);

  const businessHours = (values[SETTING_KEYS.businessHours] as BusinessHours) ?? DEFAULT_BUSINESS_HOURS;
  const cancellation =
    (values[SETTING_KEYS.cancellationPolicy] as CancellationPolicy) ?? DEFAULT_CANCELLATION_POLICY;
  const bank = (values[SETTING_KEYS.bankAccount] as BankAccountDetails) ?? DEFAULT_BANK_ACCOUNT;
  const languages =
    (values[SETTING_KEYS.languagesEnabled] as ('en' | 'ar')[]) ?? DEFAULT_LANGUAGES_ENABLED;
  const deposits = (values[SETTING_KEYS.defaultDeposits] as Record<string, number>) ?? {};
  const emailTemplates =
    (values[SETTING_KEYS.emailTemplates] as Record<string, EmailTemplate>) ?? DEFAULT_EMAIL_TEMPLATES;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Business configuration. Advance-book rules per category live in{' '}
          <Link href="/manager/categories" className="text-primary underline">
            Categories
          </Link>
          .
        </p>
      </div>

      <SettingsTabs
        businessHours={businessHours}
        cancellation={cancellation}
        bank={bank}
        languages={languages}
        deposits={deposits}
        emailTemplates={emailTemplates}
        categories={categories.map((c) => ({ id: c.id, slug: c.slug, nameEn: c.nameEn, defaultDepositAed: c.defaultDepositAed }))}
      />
    </div>
  );
}
