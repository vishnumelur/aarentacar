# OpenDKIM milter (Plan #12, Task 2).
# Signs outbound mail handed over by Postfix on the internal network. The
# private key lives in a read-only mounted volume (./docker/opendkim/keys),
# generated once via scripts/dkim-keygen.sh. verify-on-deploy: the signing
# handshake + DNS DKIM validation can only be confirmed against a live deploy.
FROM alpine:3.19

RUN apk add --no-cache opendkim opendkim-utils

COPY opendkim.conf /etc/opendkim/opendkim.conf
COPY KeyTable /etc/opendkim/KeyTable
COPY SigningTable /etc/opendkim/SigningTable
COPY TrustedHosts /etc/opendkim/TrustedHosts

EXPOSE 8891

# Foreground (-f), bind to the milter socket declared in opendkim.conf.
CMD ["opendkim", "-f", "-x", "/etc/opendkim/opendkim.conf"]
