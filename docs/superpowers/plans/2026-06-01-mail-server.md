# AA Rent A Car — Plan #12: Self-Hosted Mail Server Implementation Plan

> REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Replace the placeholder mail with a fully self-hosted Postfix + OpenDKIM stack running in docker-compose, sending real transactional emails (account verification, KYC approved/rejected, booking confirmed, payment receipt, driver dispatched, return reminder, agreement PDF). All DNS via Cloudflare. **After this plan ships:** the platform sends real branded email at zero monthly cost.

**Spec reference:** §11.5 (the full mail-server architecture — Postfix + OpenDKIM, Cloudflare DNS records, reverse DNS, IP warm-up plan).

---

## File Structure
- `docker/postfix/` — Dockerfile, main.cf, master.cf
- `docker/opendkim/` — Dockerfile, config, key generation script
- `docker-compose.yml` (production) — adds `postfix` + `opendkim` services + `clamav`
- `src/lib/mail/transport.ts` — nodemailer with SMTP to `postfix:25`
- `src/lib/mail/render.ts` — template renderer (react-email or handlebars + MJML)
- `src/lib/mail/templates/` — one file per transactional email
- `src/lib/mail/send.ts` — enqueue via pg-boss
- `src/lib/jobs/handlers/send-email.ts` — worker handler
- `scripts/dkim-keygen.sh` — generates the DKIM key pair, prints the TXT record value
- `docs/mail-setup.md` — operator runbook for Cloudflare DNS + Hetzner PTR
- Modify Plan #11 worker.ts to register `send-email` handler

## Task 1: Postfix container
```dockerfile
# docker/postfix/Dockerfile
FROM alpine:3.19
RUN apk add --no-cache postfix
COPY main.cf /etc/postfix/
COPY master.cf /etc/postfix/
EXPOSE 25
CMD ["postfix","start-fg"]
```
main.cf binds to internal Docker network only (no port mapping in compose). Configure to relay via OpenDKIM.

## Task 2: OpenDKIM container + key generation
```dockerfile
FROM alpine:3.19
RUN apk add --no-cache opendkim opendkim-utils
COPY opendkim.conf /etc/opendkim/
COPY KeyTable SigningTable /etc/opendkim/
```
`scripts/dkim-keygen.sh`:
```bash
#!/bin/bash
opendkim-genkey -s default -d aa-rentacar.com -b 2048
echo "Add this TXT record at default._domainkey.aa-rentacar.com:"
cat default.txt
```

## Task 3: docker-compose additions
```yaml
postfix:
  build: ./docker/postfix
  restart: unless-stopped
  networks: [internal]
  volumes:
    - postfix-spool:/var/spool/postfix
  depends_on: [opendkim]

opendkim:
  build: ./docker/opendkim
  restart: unless-stopped
  networks: [internal]
  volumes:
    - ./docker/opendkim/keys:/etc/opendkim/keys:ro

clamav:
  image: clamav/clamav:stable
  restart: unless-stopped
  networks: [internal]
  volumes:
    - clamav-db:/var/lib/clamav
```
(ClamAV usage for upload scanning is wired in Plan #13's production-deploy plan.)

## Task 4: DNS setup runbook
`docs/mail-setup.md` — step-by-step in Cloudflare dashboard:
- A: aa-rentacar.com → VPS IP (proxied OFF for mail subdomain)
- MX: aa-rentacar.com → route1/2.mx.cloudflare.net (inbound via Cloudflare Email Routing)
- SPF TXT: `v=spf1 ip4:<VPS_IP> ~all`
- DKIM TXT: at `default._domainkey.aa-rentacar.com`, value from `dkim-keygen.sh`
- DMARC TXT: at `_dmarc.aa-rentacar.com`, `v=DMARC1; p=quarantine; rua=mailto:dmarc@aa-rentacar.com`
- Hetzner: set reverse DNS (PTR) for VPS IP to `mail.aa-rentacar.com`

## Task 5: Cloudflare Email Routing for inbound
Cloudflare dashboard → Email Routing → forward `*@aa-rentacar.com` to user's existing inbox (Gmail or whatever). `no-reply@aa-rentacar.com` gets a "drop" rule so customer replies don't bounce.

## Task 6: Mail transport (Node)
```ts
// src/lib/mail/transport.ts
import nodemailer from 'nodemailer';
import { getCredential } from '@/lib/credentials/store'; // Plan #9
export async function getTransport() {
  const host = await getCredential('smtp', 'host') ?? 'postfix';
  const port = Number(await getCredential('smtp', 'port') ?? 25);
  const from = await getCredential('smtp', 'from') ?? 'no-reply@aa-rentacar.com';
  return { transport: nodemailer.createTransport({ host, port, secure: false }), from };
}
```

## Task 7: Templates with react-email
`pnpm add react-email @react-email/components`. One TSX file per email:
- `welcome.tsx`
- `kyc-approved.tsx` / `kyc-rejected.tsx`
- `booking-confirmed.tsx`
- `payment-receipt.tsx` (with PDF attachment)
- `driver-dispatched.tsx`
- `return-reminder.tsx`
- `password-reset.tsx`
All bilingual via passed-in `locale` prop; CSS-in-JS via Tailwind classes (react-email supports it).

## Task 8: Send-email pg-boss handler
```ts
boss.work('send-email', async (job) => {
  const { to, templateName, locale, payload } = job.data;
  const html = await renderTemplate(templateName, locale, payload);
  const { transport, from } = await getTransport();
  await transport.sendMail({ from, to, subject: subjectFor(templateName, locale, payload), html });
});
```

## Task 9: Wire app events
- KYC approve/reject (Plan #3 kyc-review.ts) → enqueue send-email with template kyc-approved|kyc-rejected
- Booking creation, payment success, dispatch, return → matching templates
- Password reset (Plan #1 was deferred without a real email channel — now wires up)

## Task 10: IP warm-up + monitoring
- Document the 14-day warm-up plan in `docs/mail-setup.md` (10/day day 1-7, 50/day day 8-14, then production volume)
- Postfix logs: `docker compose logs postfix | grep -E "(status=sent|status=bounced)"` → counts
- Bounce-rate dashboard: simple pg-boss job parses logs nightly into a `mail_events` table (or use postfix's accounting log)
- Surface in Super-Admin → System (Plan #11) as a card

## Task 11: Fallback to managed SMTP
If deliverability is poor, the operator pastes a Mailgun/SES/Brevo SMTP credential into the Plan #9 Provider Credentials UI; transport.ts then uses that instead. Zero code change.

## Acceptance
- `docker compose up -d` brings up postfix + opendkim
- DKIM TXT record correctly published, validates via `dig +short txt default._domainkey.aa-rentacar.com`
- Sending a test email to a Gmail address arrives in inbox (not spam) with DKIM + SPF + DMARC headers all PASS
- Customer signup triggers welcome email
- Bounce log captured in mail_events

## Not in this plan
- IMAP / webmail for the team (use Cloudflare Email Routing → Gmail instead, as per spec)
- WhatsApp delivery channel (deferred — Phase 2)
