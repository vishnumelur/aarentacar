# Postfix relay (Plan #12, Task 1).
# Internal-only SMTP relay on the Docker `internal` network. NOT port-mapped to
# the host — the app/worker reach it as `postfix:25`. Signs outbound mail via
# the OpenDKIM milter (see opendkim service). verify-on-deploy: a real
# Postfix start + outbound delivery cannot be exercised in CI.
FROM alpine:3.19

RUN apk add --no-cache postfix ca-certificates

COPY main.cf /etc/postfix/main.cf
COPY master.cf /etc/postfix/master.cf

EXPOSE 25

# start-fg runs Postfix in the foreground so the container stays alive and logs
# to stdout (captured by `docker compose logs postfix`).
CMD ["postfix", "start-fg"]
