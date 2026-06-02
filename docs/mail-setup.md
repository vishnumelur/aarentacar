# Mail Server Operator Runbook (Plan #12)

Self-hosted **Postfix + OpenDKIM** stack for AA Rent A Car transactional email.
Inbound mail is handled by **Cloudflare Email Routing**; outbound is sent
directly from the production VPS at zero monthly cost.

> Everything below is **verify-on-deploy**: it requires the live production VPS,
> a real public IP with reverse DNS, and DNS records in Cloudflare. None of it
> can be exercised in CI. The application-side send path (template render +
> nodemailer transport + pg-boss `send-email` worker) is unit-tested with a
> mocked transport.

---

## 0. Architecture at a glance

```
signup / KYC / booking / payment / dispatch / return / password-reset
        │  enqueueEmailSafe()  (src/lib/mail/send.ts)
        ▼
   pg-boss  ── send-email job ──►  worker (scripts/worker.ts)
                                     │ renderTemplate() + subjectFor()
                                     │ getTransport()  (nodemailer)
                                     ▼
                               postfix:25  ──►  OpenDKIM milter (sign)
                                                     │
                                                     ▼  direct-to-MX
                                              recipient mail server (Gmail, …)
        mail_events table  ◄── recordEvent() (queued/sent/failed/bounced)
```

- Transport prefers the Plan #9 **credential store** (`getCredential('smtp', …)`)
  and falls back to `SMTP_*` env vars. Defaults: host `postfix`, port `25`,
  from `no-reply@aa-rentacar.com`.
- **Managed-SMTP fallback (Task 11):** paste a Mailgun/SES/Brevo host, port,
  user, and password into Super-Admin → Provider Credentials → SMTP. The
  transport auto-switches to authenticated submission (STARTTLS) with **zero
  code change** — no redeploy needed.

---

## 1. Bring up the stack (production host)

```bash
# 1. Generate the DKIM key pair once (writes docker/opendkim/keys/default.private)
bash scripts/dkim-keygen.sh        # prints the TXT record to publish

# 2. Start the mail services
docker compose -f docker-compose.prod.yml up -d postfix opendkim clamav

# 3. Confirm both are healthy
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs opendkim | grep -i "OpenDKIM"
```

Postfix is **internal-only** (no host port). The app/worker reach it as
`postfix:25` on the compose `internal` network.

---

## 2. Cloudflare DNS records (Task 4)

In the Cloudflare dashboard for **aa-rentacar.com** → DNS → Records.
Replace `<VPS_IP>` with the production server's public IPv4.

| Type  | Name                              | Value                                              | Proxy |
|-------|-----------------------------------|----------------------------------------------------|-------|
| A     | `mail`                            | `<VPS_IP>`                                          | **OFF** (DNS only) |
| A     | `@` (aa-rentacar.com)             | `<VPS_IP>`                                          | as needed for web |
| MX    | `@`                               | `route1.mx.cloudflare.net` (priority 10)           | n/a   |
| MX    | `@`                               | `route2.mx.cloudflare.net` (priority 20)           | n/a   |
| MX    | `@`                               | `route3.mx.cloudflare.net` (priority 30)           | n/a   |
| TXT   | `@` (SPF)                         | `v=spf1 ip4:<VPS_IP> ~all`                          | n/a   |
| TXT   | `default._domainkey`              | (DKIM value printed by `scripts/dkim-keygen.sh`)   | n/a   |
| TXT   | `_dmarc`                          | `v=DMARC1; p=quarantine; rua=mailto:dmarc@aa-rentacar.com` | n/a |

Notes:
- The **mail subdomain A record must have the Cloudflare proxy OFF** (grey
  cloud) — mail cannot flow through Cloudflare's HTTP proxy.
- The MX records point at Cloudflare Email Routing (Task 5), not at the VPS;
  the VPS is **send-only**.
- DKIM TXT is the long `p=...` value inside `default.txt`. If Cloudflare
  complains about length, split it into multiple quoted strings exactly as
  `opendkim-genkey` emits them.

---

## 3. Hetzner reverse DNS / PTR (Task 4)

A matching PTR record is mandatory or Gmail/Outlook will reject or spam-fold
mail.

1. Hetzner Cloud Console → Server → **Networking** → IPv4 → **Edit reverse DNS**.
2. Set the PTR for `<VPS_IP>` to `mail.aa-rentacar.com`.
3. Verify: `dig +short -x <VPS_IP>` → must return `mail.aa-rentacar.com.`

The forward (`A mail → <VPS_IP>`) and reverse (`PTR <VPS_IP> → mail`) must agree
(FCrDNS). `myhostname` in `docker/postfix/main.cf` is already `mail.aa-rentacar.com`.

---

## 4. Cloudflare Email Routing — inbound (Task 5)

Cloudflare dashboard → **Email** → Email Routing.

1. Enable Email Routing (this auto-creates the `route*.mx.cloudflare.net` MX +
   the Cloudflare SPF include — keep both).
2. **Catch-all** `*@aa-rentacar.com` → forward to the team's existing inbox
   (e.g. the operator's Gmail). Verify the destination address.
3. Add a **drop** rule for `no-reply@aa-rentacar.com` so customer replies to
   transactional mail are silently dropped instead of bouncing.

> If both the self-hosted SPF (`ip4:<VPS_IP>`) and Cloudflare's routing SPF are
> needed, merge them into one record:
> `v=spf1 ip4:<VPS_IP> include:_spf.mx.cloudflare.net ~all`

---

## 5. Validation checklist (Acceptance)

```bash
# DKIM published?
dig +short txt default._domainkey.aa-rentacar.com

# SPF + DMARC published?
dig +short txt aa-rentacar.com
dig +short txt _dmarc.aa-rentacar.com

# Reverse DNS agrees?
dig +short -x <VPS_IP>
```

Then send a real test email to a Gmail address (trigger a signup, or use
`swaks`/`sendmail` from inside the postfix container) and in Gmail open
**Show original**. Confirm **SPF: PASS, DKIM: PASS, DMARC: PASS** and that it
landed in **Inbox, not Spam**.

---

## 6. IP warm-up plan (Task 10)

A brand-new sending IP has no reputation. Ramp volume gradually so mailbox
providers learn to trust it. Keep the bounce/complaint rate low throughout.

| Phase   | Days   | Max sends/day | Notes                                          |
|---------|--------|---------------|------------------------------------------------|
| Warm-up | 1–7    | **10/day**    | Send only to engaged/known-good addresses.     |
| Ramp    | 8–14   | **50/day**    | Watch Gmail Postmaster Tools for spam rate.    |
| Steady  | 15+    | production    | Scale to real volume once placement is stable. |

During warm-up, **throttle non-critical mail**: keep transactional (booking /
payment / password-reset) flowing; defer bulk/marketing (out of scope here —
see "Not in this plan").

If deliverability is poor after warm-up, switch to a **managed relay** (Task 11)
by pasting credentials into Super-Admin → Provider Credentials → SMTP. No code
change or redeploy is required.

---

## 7. Monitoring & bounce accounting (Task 10)

The worker records every send attempt into the **`mail_events`** table
(`status` = `queued` | `sent` | `failed` | `bounced` | `deferred`).

Postfix log spot-checks:

```bash
# sent vs bounced counts in the live log
docker compose -f docker-compose.prod.yml logs postfix \
  | grep -E "status=(sent|bounced|deferred)" \
  | grep -oE "status=[a-z]+" | sort | uniq -c
```

**verify-on-deploy — nightly bounce parser:** a pg-boss job parses the Postfix
accounting log nightly and inserts `bounced`/`deferred` rows into `mail_events`.
The Postfix log path / format is host-specific, so the parser is finalized
against the live deploy. Until then, `mail_events` already captures `sent` /
`failed` from the `send-email` handler.

The Super-Admin → System page surfaces a **mail deliverability card** reading
aggregate counts from `mail_events` (see `src/lib/mail/stats.ts`).

---

## Not in this plan
- IMAP / webmail for the team (use Cloudflare Email Routing → Gmail instead).
- WhatsApp delivery channel (deferred — Phase 2).
- Bulk / marketing email (transactional only here).
