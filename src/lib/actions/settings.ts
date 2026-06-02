'use server';

import { z } from 'zod';
import { sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { settings, auditLogs } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { userCanAgent } from '@/lib/auth/agent-guard';
import { SETTING_KEYS } from '@/lib/settings/keys';

type SettingsError = 'forbidden' | 'invalid_input';
export type SettingsOutcome = { ok: true } | { ok: false; error: SettingsError };

async function upsertSetting(key: string, value: unknown, userId: string): Promise<void> {
  await db
    .insert(settings)
    .values({ key, value: value as object, updatedByUserId: userId, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: value as object, updatedByUserId: userId, updatedAt: new Date() },
    });
}

async function gate(): Promise<{ ok: true; userId: string } | { ok: false; error: 'forbidden' }> {
  const user = await getCurrentUser();
  if (!(await userCanAgent(user, 'edit_settings'))) {
    return { ok: false, error: 'forbidden' };
  }
  return { ok: true, userId: user!.id };
}

function revalidate(): void {
  revalidatePath('/manager/settings');
  revalidatePath('/'); // landing page reflects business hours/languages
}

const timeOrEmpty = z
  .union([z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), z.literal('')])
  .transform((v) => (v === '' ? null : v));

const businessHoursSchema = z.object({ open: timeOrEmpty, close: timeOrEmpty });

export async function saveBusinessHours(formData: FormData): Promise<SettingsOutcome> {
  const g = await gate();
  if (!g.ok) return g;
  const parsed = businessHoursSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: 'invalid_input' };
  await upsertSetting(SETTING_KEYS.businessHours, parsed.data, g.userId);
  await audit(g.userId, SETTING_KEYS.businessHours);
  revalidate();
  return { ok: true };
}

const cancellationSchema = z.object({
  freeUntilHoursBefore: z.coerce.number().int().min(0).max(720),
  halfUntilHoursBefore: z.coerce.number().int().min(0).max(720),
  noRefundUntilHandover: z
    .union([z.literal('on'), z.literal('true'), z.literal('false'), z.boolean()])
    .optional()
    .transform((v) => v === 'on' || v === 'true' || v === true),
});

export async function saveCancellationPolicy(formData: FormData): Promise<SettingsOutcome> {
  const g = await gate();
  if (!g.ok) return g;
  const parsed = cancellationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: 'invalid_input' };
  if (parsed.data.halfUntilHoursBefore > parsed.data.freeUntilHoursBefore) {
    return { ok: false, error: 'invalid_input' };
  }
  await upsertSetting(SETTING_KEYS.cancellationPolicy, parsed.data, g.userId);
  await audit(g.userId, SETTING_KEYS.cancellationPolicy);
  revalidate();
  return { ok: true };
}

const bankSchema = z.object({
  bankName: z.string().max(120).default(''),
  accountName: z.string().max(120).default(''),
  accountNumber: z.string().max(60).default(''),
  iban: z.string().max(60).default(''),
  swift: z.string().max(40).default(''),
});

export async function saveBankAccount(formData: FormData): Promise<SettingsOutcome> {
  const g = await gate();
  if (!g.ok) return g;
  const parsed = bankSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: 'invalid_input' };
  await upsertSetting(SETTING_KEYS.bankAccount, parsed.data, g.userId);
  await audit(g.userId, SETTING_KEYS.bankAccount);
  revalidate();
  return { ok: true };
}

export async function saveLanguages(formData: FormData): Promise<SettingsOutcome> {
  const g = await gate();
  if (!g.ok) return g;
  const raw = Object.fromEntries(formData);
  const enabled: ('en' | 'ar')[] = [];
  if (raw.en === 'on' || raw.en === 'true') enabled.push('en');
  if (raw.ar === 'on' || raw.ar === 'true') enabled.push('ar');
  if (enabled.length === 0) enabled.push('en'); // never disable everything
  await upsertSetting(SETTING_KEYS.languagesEnabled, enabled, g.userId);
  await audit(g.userId, SETTING_KEYS.languagesEnabled);
  revalidate();
  return { ok: true };
}

const depositsSchema = z.record(z.string(), z.coerce.number().int().min(0).max(1_000_000));

export async function saveDefaultDeposits(formData: FormData): Promise<SettingsOutcome> {
  const g = await gate();
  if (!g.ok) return g;
  const parsed = depositsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: 'invalid_input' };
  await upsertSetting(SETTING_KEYS.defaultDeposits, parsed.data, g.userId);
  await audit(g.userId, SETTING_KEYS.defaultDeposits);
  revalidate();
  return { ok: true };
}

const emailTemplateSchema = z.object({
  templateKey: z.string().min(1).max(80),
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(5000),
});

export async function saveEmailTemplate(formData: FormData): Promise<SettingsOutcome> {
  const g = await gate();
  if (!g.ok) return g;
  const parsed = emailTemplateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: 'invalid_input' };

  // Merge into the existing templates map.
  const [existing] = await db
    .select({ value: settings.value })
    .from(settings)
    .where(sql`${settings.key} = ${SETTING_KEYS.emailTemplates}`)
    .limit(1);
  const current = (existing?.value as Record<string, unknown> | undefined) ?? {};
  const next = {
    ...current,
    [parsed.data.templateKey]: { subject: parsed.data.subject, body: parsed.data.body },
  };
  await upsertSetting(SETTING_KEYS.emailTemplates, next, g.userId);
  await audit(g.userId, SETTING_KEYS.emailTemplates);
  revalidate();
  return { ok: true };
}

async function audit(userId: string, key: string): Promise<void> {
  await db.insert(auditLogs).values({
    actorUserId: userId,
    action: 'settings.updated',
    targetType: 'setting',
    targetId: key,
    payload: { key },
  });
}
