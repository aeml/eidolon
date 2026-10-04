# Independent readiness monitor

Prepared for Alpha 1.78; not installed or enabled in production. Build with
`go build ./cmd/monitor`. Run outside the game process so a game crash remains
observable. All timing/threshold settings must be chosen explicitly; these are
configuration controls, not an approved SLA or hosting-capacity claim.

Required flags: `-health-url`, `-request-timeout` (positive, at most 10s),
`-poll-interval` (1s–5m), `-failure-threshold` and `-recovery-threshold` (1–60),
and `-notice-cooldown` (1m–24h). Optional `-expected-commit` requires the exact
release identity in addition to readiness. The URL must be HTTPS or loopback
HTTP with path `/healthz`, without credentials, query strings or fragments.
Redirects are refused and TLS verification remains enabled.

Stdout contains one JSON line per outage, cooldown reminder or sustained
recovery, with sanitized cause, release identity and request latency. Healthy
polling is silent. No URLs, arbitrary peer/error text, account records or mail
credentials are output. SIGINT/SIGTERM stop polling; cancellation is not an
outage. An unavailable output sink exits with a generic error.

This command does **not** deliver emails, consume `ADMIN_NOTIFICATION_EMAILS`,
install systemd, choose retention, or alter the game. Its RAM-only incident
state resets on restart. An operator-selected delivery adapter/service,
failure notification proof, delivery-failure handling, retention and budget
agreement remain required before completing the operations milestone. A
blocked output pipe can still require terminating the process; an independent
service supervisor and its output policy must be configured when installed.
