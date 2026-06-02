'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  saveBusinessHours,
  saveCancellationPolicy,
  saveBankAccount,
  saveLanguages,
  saveDefaultDeposits,
  saveEmailTemplate,
  type SettingsOutcome,
} from '@/lib/actions/settings';
import type {
  BusinessHours,
  BankAccountDetails,
  CancellationPolicy,
  EmailTemplate,
} from '@/lib/settings/keys';

interface CategoryLite {
  id: string;
  slug: string;
  nameEn: string;
  defaultDepositAed: number;
}

interface Props {
  businessHours: BusinessHours;
  cancellation: CancellationPolicy;
  bank: BankAccountDetails;
  languages: ('en' | 'ar')[];
  deposits: Record<string, number>;
  emailTemplates: Record<string, EmailTemplate>;
  categories: CategoryLite[];
}

const TABS = [
  { key: 'hours', label: 'Business hours' },
  { key: 'deposits', label: 'Deposits' },
  { key: 'cancellation', label: 'Cancellation' },
  { key: 'languages', label: 'Languages' },
  { key: 'bank', label: 'Bank account' },
  { key: 'email', label: 'Email templates' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export function SettingsTabs(props: Props) {
  const [tab, setTab] = useState<TabKey>('hours');
  const router = useRouter();
  const [pending, start] = useTransition();

  function submit(action: (fd: FormData) => Promise<SettingsOutcome>) {
    return (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      start(async () => {
        const res = await action(fd);
        if (res.ok) {
          toast.success('Saved.');
          router.refresh();
        } else {
          toast.error(`Failed: ${res.error}`);
        }
      });
    };
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 border-b">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${tab === t.key ? 'border-primary font-medium' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="rounded-lg border bg-card p-6">
        {tab === 'hours' && (
          <form onSubmit={submit(saveBusinessHours)} className="max-w-sm space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="open">Open</Label>
              <Input id="open" name="open" type="time" defaultValue={props.businessHours.open ?? ''} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="close">Close</Label>
              <Input id="close" name="close" type="time" defaultValue={props.businessHours.close ?? ''} />
            </div>
            <SaveButton pending={pending} />
          </form>
        )}

        {tab === 'deposits' && (
          <form onSubmit={submit(saveDefaultDeposits)} className="max-w-md space-y-4">
            <p className="text-sm text-muted-foreground">
              Default refundable deposit per category (AED). Used when computing new bookings.
            </p>
            {props.categories.map((c) => (
              <div key={c.id} className="space-y-1.5">
                <Label htmlFor={`dep-${c.slug}`}>{c.nameEn}</Label>
                <Input
                  id={`dep-${c.slug}`}
                  name={c.slug}
                  type="number"
                  min={0}
                  defaultValue={props.deposits[c.slug] ?? c.defaultDepositAed}
                />
              </div>
            ))}
            <SaveButton pending={pending} />
          </form>
        )}

        {tab === 'cancellation' && (
          <form onSubmit={submit(saveCancellationPolicy)} className="max-w-sm space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="freeUntilHoursBefore">Free cancel until (hours before pickup)</Label>
              <Input
                id="freeUntilHoursBefore"
                name="freeUntilHoursBefore"
                type="number"
                min={0}
                defaultValue={props.cancellation.freeUntilHoursBefore}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="halfUntilHoursBefore">50% refund until (hours before pickup)</Label>
              <Input
                id="halfUntilHoursBefore"
                name="halfUntilHoursBefore"
                type="number"
                min={0}
                defaultValue={props.cancellation.halfUntilHoursBefore}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="noRefundUntilHandover"
                defaultChecked={props.cancellation.noRefundUntilHandover}
                className="size-4"
              />
              No refund once vehicle handed over
            </label>
            <SaveButton pending={pending} />
          </form>
        )}

        {tab === 'languages' && (
          <form onSubmit={submit(saveLanguages)} className="max-w-sm space-y-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="en" defaultChecked={props.languages.includes('en')} className="size-4" />
              English
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="ar" defaultChecked={props.languages.includes('ar')} className="size-4" />
              Arabic
            </label>
            <SaveButton pending={pending} />
          </form>
        )}

        {tab === 'bank' && (
          <form onSubmit={submit(saveBankAccount)} className="max-w-md space-y-4">
            <Field name="bankName" label="Bank name" value={props.bank.bankName} />
            <Field name="accountName" label="Account name" value={props.bank.accountName} />
            <Field name="accountNumber" label="Account number" value={props.bank.accountNumber} />
            <Field name="iban" label="IBAN" value={props.bank.iban} />
            <Field name="swift" label="SWIFT/BIC" value={props.bank.swift} />
            <SaveButton pending={pending} />
          </form>
        )}

        {tab === 'email' && (
          <div className="space-y-6">
            <p className="text-sm text-muted-foreground">
              Placeholders like <code>{'{{code}}'}</code> are filled at send time (Plan #12 renderer).
            </p>
            {Object.entries(props.emailTemplates).map(([key, tpl]) => (
              <form key={key} onSubmit={submit(saveEmailTemplate)} className="space-y-3 rounded-md border p-4">
                <div className="font-mono text-xs text-muted-foreground">{key}</div>
                <input type="hidden" name="templateKey" value={key} />
                <div className="space-y-1.5">
                  <Label htmlFor={`subj-${key}`}>Subject</Label>
                  <Input id={`subj-${key}`} name="subject" defaultValue={tpl.subject} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`body-${key}`}>Body</Label>
                  <textarea
                    id={`body-${key}`}
                    name="body"
                    rows={4}
                    defaultValue={tpl.body}
                    className="w-full rounded-lg border border-border bg-background p-2 text-sm"
                  />
                </div>
                <SaveButton pending={pending} />
              </form>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ name, label, value }: { name: string; label: string; value: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} defaultValue={value} />
    </div>
  );
}

function SaveButton({ pending }: { pending: boolean }) {
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Saving…' : 'Save'}
    </Button>
  );
}
