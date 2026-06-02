#!/bin/bash
# DKIM key generation (Plan #12, Task 2).
#
# Generates a 2048-bit RSA DKIM key pair for selector `default` on
# aa-rentacar.com and writes it into docker/opendkim/keys/ (the dir mounted
# read-only into the opendkim container). Prints the TXT record to publish at
# default._domainkey.aa-rentacar.com in Cloudflare (see docs/mail-setup.md).
#
# Run once on the production host:
#   bash scripts/dkim-keygen.sh
#
# verify-on-deploy: the generated public key must be published in DNS and then
# validated with `dig +short txt default._domainkey.aa-rentacar.com` — neither
# can be exercised in CI.
set -euo pipefail

DOMAIN="${DKIM_DOMAIN:-aa-rentacar.com}"
SELECTOR="${DKIM_SELECTOR:-default}"
KEYS_DIR="$(dirname "$0")/../docker/opendkim/keys"

mkdir -p "$KEYS_DIR"
cd "$KEYS_DIR"

if ! command -v opendkim-genkey >/dev/null 2>&1; then
  echo "opendkim-genkey not found. Install opendkim-utils (apk add opendkim-utils / apt-get install opendkim-tools)." >&2
  exit 1
fi

opendkim-genkey -s "$SELECTOR" -d "$DOMAIN" -b 2048

# opendkim-genkey writes <selector>.private and <selector>.txt
chmod 600 "${SELECTOR}.private"

echo
echo "================================================================"
echo "DKIM key generated for ${SELECTOR}._domainkey.${DOMAIN}"
echo "Private key: ${KEYS_DIR}/${SELECTOR}.private (mounted into opendkim)"
echo
echo "Add this TXT record in Cloudflare at ${SELECTOR}._domainkey.${DOMAIN}:"
echo "----------------------------------------------------------------"
cat "${SELECTOR}.txt"
echo "----------------------------------------------------------------"
echo "Then validate with: dig +short txt ${SELECTOR}._domainkey.${DOMAIN}"
echo "================================================================"
