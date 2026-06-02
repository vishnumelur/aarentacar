import type { SendEmailJob } from '@/lib/mail/send';
import type { MailLocale, TemplateName, TemplatePayloads } from '@/lib/mail/templates/types';
import { isTemplateName } from '@/lib/mail/templates/types';

/**
 * Pure orchestration for the `send-email` pg-boss job (Plan #12, Task 8),
 * mirroring the dependency-injection style of src/lib/jobs/handlers.ts so the
 * decision logic is unit-testable with a mocked transport (no real SMTP).
 *
 * The real IO wiring (nodemailer transport, react-email render, mail_events
 * insert) is built in scripts/worker.ts and passed in as deps.
 */

export interface SentMail {
  messageId?: string;
}

export interface SendEmailDeps {
  render: (template: TemplateName, locale: MailLocale, payload: object) => Promise<string>;
  renderText?: (template: TemplateName, locale: MailLocale, payload: object) => Promise<string>;
  subjectFor: (template: TemplateName, locale: MailLocale, payload: object) => string;
  getTransport: () => Promise<{
    from: string;
    transport: {
      sendMail: (opts: {
        from: string;
        to: string;
        subject: string;
        html: string;
        text?: string;
        attachments?: Array<{ filename: string; content: Buffer; contentType?: string }>;
      }) => Promise<SentMail>;
    };
  }>;
  /** Record the outcome in mail_events. Best-effort; must not throw. */
  recordEvent: (event: {
    toAddress: string;
    template: string;
    locale: string;
    status: 'sent' | 'failed';
    messageId?: string | null;
    detail?: string | null;
    payload?: Record<string, unknown> | null;
  }) => Promise<void>;
}

export interface SendEmailResult {
  status: 'sent' | 'failed';
  messageId?: string | null;
}

export async function runSendEmail(job: SendEmailJob, deps: SendEmailDeps): Promise<SendEmailResult> {
  const { to, templateName, locale, payload, attachment } = job;

  if (!isTemplateName(templateName)) {
    await deps.recordEvent({
      toAddress: to,
      template: templateName,
      locale,
      status: 'failed',
      detail: `unknown template: ${templateName}`,
    });
    throw new Error(`unknown mail template: ${templateName}`);
  }

  const normalizedLocale: MailLocale = locale === 'ar' ? 'ar' : 'en';

  try {
    const html = await deps.render(templateName, normalizedLocale, payload);
    const text = deps.renderText
      ? await deps.renderText(templateName, normalizedLocale, payload)
      : undefined;
    const subject = deps.subjectFor(templateName, normalizedLocale, payload);
    const { transport, from } = await deps.getTransport();

    const attachments = attachment
      ? [
          {
            filename: attachment.filename,
            content: Buffer.from(attachment.contentBase64, 'base64'),
            contentType: attachment.contentType ?? 'application/pdf',
          },
        ]
      : undefined;

    const info = await transport.sendMail({ from, to, subject, html, text, attachments });

    await deps.recordEvent({
      toAddress: to,
      template: templateName,
      locale: normalizedLocale,
      status: 'sent',
      messageId: info.messageId ?? null,
      payload: payload as Record<string, unknown>,
    });

    return { status: 'sent', messageId: info.messageId ?? null };
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'unknown';
    await deps.recordEvent({
      toAddress: to,
      template: templateName,
      locale: normalizedLocale,
      status: 'failed',
      detail,
      payload: payload as Record<string, unknown>,
    });
    // Rethrow so pg-boss marks the job failed and retries per its policy.
    throw err;
  }
}

export type { TemplatePayloads };
