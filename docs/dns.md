# DNS Records (Plan #13, Task 9)

Cloudflare DNS for `aa-rentacar.com`. Replace `<VPS_IPv4>` / `<VPS_IPv6>` with
the Hetzner server IPs. **verify-on-deploy** — set these in the Cloudflare
dashboard once the VPS is up.

> **Proxy status:** keep the web records **DNS-only (grey cloud)** for the
> initial launch. Cloudflare's orange-cloud proxy interacts with Caddy's
> Let's Encrypt and with Mapbox/Stripe CSP (see "Not in this plan" in the
> deploy plan) — defer turning it on. The `mail` record MUST be DNS-only.

## A / AAAA — web + mail
| Type | Name | Value | Proxy |
|------|------|-------|-------|
| A | `@` (apex) | `<VPS_IPv4>` | DNS-only |
| A | `www` | `<VPS_IPv4>` | DNS-only |
| A | `manager` | `<VPS_IPv4>` | DNS-only |
| A | `driver` | `<VPS_IPv4>` | DNS-only |
| A | `admin` | `<VPS_IPv4>` | DNS-only |
| A | `mail` | `<VPS_IPv4>` | DNS-only |
| AAAA | `@`,`www`,`manager`,`driver`,`admin`,`mail` | `<VPS_IPv6>` | DNS-only |

(All four web subdomains point at the same VPS; Caddy + the app route by host.)

## MX — inbound (Cloudflare Email Routing per Plan #12)
| Type | Name | Value | Priority |
|------|------|-------|----------|
| MX | `@` | `route1.mx.cloudflare.net` | 10 |
| MX | `@` | `route2.mx.cloudflare.net` | 20 |
| MX | `@` | `route3.mx.cloudflare.net` | 30 |

## Mail authentication (Plan #12)
| Type | Name | Value |
|------|------|-------|
| TXT | `@` | `v=spf1 ip4:<VPS_IPv4> include:_spf.mx.cloudflare.net -all` |
| TXT | `default._domainkey` | `v=DKIM1; k=rsa; p=<DKIM_PUBLIC_KEY>` (from `scripts/dkim-keygen.sh`) |
| TXT | `_dmarc` | `v=DMARC1; p=quarantine; rua=mailto:dmarc@aa-rentacar.com; adkim=s; aspf=s` |

## PTR / reverse DNS
Set in the **Hetzner** console (not Cloudflare):
- `<VPS_IPv4>` → `aa-rentacar.com`
- also `mail.aa-rentacar.com` for the outbound MTA.

## Verification
```bash
dig +short aa-rentacar.com a
dig +short www.aa-rentacar.com a
dig +short manager.aa-rentacar.com a
dig +short driver.aa-rentacar.com a
dig +short admin.aa-rentacar.com a
dig +short aa-rentacar.com txt          # SPF
dig +short default._domainkey.aa-rentacar.com txt   # DKIM
dig +short _dmarc.aa-rentacar.com txt   # DMARC
dig +short -x <VPS_IPv4>                # PTR
```
