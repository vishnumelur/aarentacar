import nodemailer, { type Transporter } from 'nodemailer';
import { getCredential } from '@/lib/credentials/store';

/**
 * Mail transport (Plan #12, Task 6).
 *
 * Builds a nodemailer SMTP transport pointed at the in-cluster Postfix relay
 * (`postfix:25`) by default. Host/port/from/user/password resolve through the
 * Plan #9 encrypted credential store, which itself falls back to the
 * SMTP_* env vars — so pasting a managed-SMTP credential (Mailgun/SES/Brevo)
 * into the Super-Admin Provider Credentials UI switches the relay with zero
 * code change (Task 11).
 *
 * Node runtime only. verify-on-deploy: a live SMTP handshake against a real
 * Postfix/relay cannot be exercised in CI — the send path is unit-tested with
 * a mocked nodemailer transport instead.
 */

export interface MailTransport {
  transport: Transporter;
  from: string;
}

export async function getTransport(): Promise<MailTransport> {
  const host = (await getCredential('smtp', 'host')) ?? 'postfix';
  const port = Number((await getCredential('smtp', 'port')) ?? 25);
  const from = (await getCredential('smtp', 'from')) ?? 'no-reply@aa-rentacar.com';
  const fromName = (await getCredential('smtp', 'from_name')) ?? 'AA Rent A Car';
  const user = (await getCredential('smtp', 'user')) ?? undefined;
  const password = (await getCredential('smtp', 'password')) ?? undefined;

  // Plain SMTP submission to the internal relay (no TLS on the Docker network).
  // A managed relay typically wants 587 + STARTTLS + auth, which is enabled
  // automatically once a user/password credential is present.
  const secure = port === 465;
  const auth = user && password ? { user, pass: password } : undefined;

  const transport = nodemailer.createTransport({
    host,
    port,
    secure,
    auth,
    // STARTTLS opportunistically when talking to a remote relay; not required
    // for the internal postfix:25 hop.
    requireTLS: Boolean(auth) && !secure,
  });

  return { transport, from: `${fromName} <${from}>` };
}
