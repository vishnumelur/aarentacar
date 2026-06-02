import { enqueue, JOB_NAMES } from '@/lib/jobs/queue';
import type { MailLocale, TemplateName, TemplatePayloads } from './templates/types';

/**
 * Email enqueue API (Plan #12, Task 8). Call sites push a `send-email` job onto
 * pg-boss; the worker (scripts/worker.ts) renders the template and hands it to
 * the SMTP transport. Keeping the request path free of SMTP latency.
 *
 * `enqueueEmail` is intentionally throwing — call sites that must not fail the
 * primary action should use `enqueueEmailSafe`, which swallows + logs.
 */

export interface SendEmailJob {
  to: string;
  templateName: TemplateName;
  locale: MailLocale;
  payload: Record<string, unknown>;
  /** Optional base64 PDF attachment (e.g. the rental agreement). */
  attachment?: { filename: string; contentBase64: string; contentType?: string } | null;
}

export async function enqueueEmail<T extends TemplateName>(args: {
  to: string;
  templateName: T;
  locale: MailLocale;
  payload: TemplatePayloads[T];
  attachment?: SendEmailJob['attachment'];
}): Promise<string | null> {
  const job: SendEmailJob = {
    to: args.to,
    templateName: args.templateName,
    locale: args.locale,
    payload: args.payload as Record<string, unknown>,
    attachment: args.attachment ?? null,
  };
  return enqueue(JOB_NAMES.sendEmail, job);
}

/**
 * Non-fatal enqueue. If pg-boss is unreachable the primary business action must
 * still succeed, so failures here are logged and swallowed. Returns true on a
 * successful enqueue.
 */
export async function enqueueEmailSafe<T extends TemplateName>(args: {
  to: string;
  templateName: T;
  locale: MailLocale;
  payload: TemplatePayloads[T];
  attachment?: SendEmailJob['attachment'];
}): Promise<boolean> {
  try {
    await enqueueEmail(args);
    return true;
  } catch (err) {
    console.warn(`[mail] enqueue ${args.templateName} failed`, err);
    return false;
  }
}
