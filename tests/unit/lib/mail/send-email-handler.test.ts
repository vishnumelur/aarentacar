import { describe, it, expect, vi } from 'vitest';
import { runSendEmail, type SendEmailDeps } from '@/lib/jobs/handlers/send-email';
import type { SendEmailJob } from '@/lib/mail/send';

/**
 * send-email job handler tests (Plan #12). The transport, renderer and the
 * mail_events recorder are all injected, so NO real SMTP connection or DB is
 * touched (per the plan's "mocked transport" requirement).
 */

function makeDeps(overrides: Partial<SendEmailDeps> = {}): {
  deps: SendEmailDeps;
  sendMail: ReturnType<typeof vi.fn>;
  recordEvent: ReturnType<typeof vi.fn>;
} {
  const sendMail = vi.fn().mockResolvedValue({ messageId: '<msg-123@aa-rentacar.com>' });
  const recordEvent = vi.fn().mockResolvedValue(undefined);
  const deps: SendEmailDeps = {
    render: vi.fn().mockResolvedValue('<html>hi</html>'),
    renderText: vi.fn().mockResolvedValue('hi'),
    subjectFor: vi.fn().mockReturnValue('Subject line'),
    getTransport: vi.fn().mockResolvedValue({ from: 'AA <no-reply@aa-rentacar.com>', transport: { sendMail } }),
    recordEvent,
    ...overrides,
  };
  return { deps, sendMail, recordEvent };
}

const baseJob: SendEmailJob = {
  to: 'sara@example.com',
  templateName: 'welcome',
  locale: 'en',
  payload: { name: 'Sara' },
  attachment: null,
};

describe('runSendEmail', () => {
  it('renders, sends via the transport, and records a sent event', async () => {
    const { deps, sendMail, recordEvent } = makeDeps();
    const result = await runSendEmail(baseJob, deps);

    expect(result.status).toBe('sent');
    expect(result.messageId).toBe('<msg-123@aa-rentacar.com>');
    expect(deps.render).toHaveBeenCalledWith('welcome', 'en', { name: 'Sara' });
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(sendMail.mock.calls[0]![0]).toMatchObject({
      from: 'AA <no-reply@aa-rentacar.com>',
      to: 'sara@example.com',
      subject: 'Subject line',
      html: '<html>hi</html>',
      text: 'hi',
    });
    expect(recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'sent', toAddress: 'sara@example.com', template: 'welcome' }),
    );
  });

  it('normalizes an unknown locale to en', async () => {
    const { deps } = makeDeps();
    await runSendEmail({ ...baseJob, locale: 'fr' as never }, deps);
    expect(deps.render).toHaveBeenCalledWith('welcome', 'en', { name: 'Sara' });
  });

  it('passes a base64 attachment through as a Buffer', async () => {
    const { deps, sendMail } = makeDeps();
    const contentBase64 = Buffer.from('PDFDATA').toString('base64');
    await runSendEmail(
      {
        ...baseJob,
        templateName: 'payment-receipt',
        payload: { name: 'Sara', bookingCode: 'AA-1', amountAed: 100 },
        attachment: { filename: 'agreement.pdf', contentBase64 },
      },
      deps,
    );
    const opts = sendMail.mock.calls[0]![0];
    expect(opts.attachments).toHaveLength(1);
    expect(opts.attachments[0].filename).toBe('agreement.pdf');
    expect(Buffer.isBuffer(opts.attachments[0].content)).toBe(true);
    expect(opts.attachments[0].content.toString()).toBe('PDFDATA');
    expect(opts.attachments[0].contentType).toBe('application/pdf');
  });

  it('records a failed event and rethrows when the transport throws', async () => {
    const sendMail = vi.fn().mockRejectedValue(new Error('connection refused'));
    const recordEvent = vi.fn().mockResolvedValue(undefined);
    const { deps } = makeDeps({
      getTransport: vi.fn().mockResolvedValue({ from: 'x', transport: { sendMail } }),
      recordEvent,
    });

    await expect(runSendEmail(baseJob, deps)).rejects.toThrow('connection refused');
    expect(recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed', detail: 'connection refused' }),
    );
  });

  it('rejects + records failure for an unknown template name', async () => {
    const { deps, recordEvent, sendMail } = makeDeps();
    await expect(
      runSendEmail({ ...baseJob, templateName: 'nope' as never }, deps),
    ).rejects.toThrow(/unknown mail template/);
    expect(sendMail).not.toHaveBeenCalled();
    expect(recordEvent).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed' }));
  });
});
