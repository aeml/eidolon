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

Newer servers also expose optional fixed `operational` counts for character
journal writes, database commits, journal cleanup, whole recovery passes and
Gold/EP casino transfer calls. The health path reads only an in-memory snapshot,
not player records or filesystem scans. Each group counts completed calls and
returned failures since process start; retries count again, and errors may mean
ambiguous writes or rejected input, not lost money. Cleanup errors remain distinct
from confirmed database commits. These are neither unique payouts, balances,
pending-entitlement gauges nor an exactly-once/durability certificate. Missing or
partial aggregates on older servers are omitted, not invented as zero. The probe
filters unknown fields and rejects negative, overflowing or impossible counts.
No automatic currency-pressure alerts, financial compensation, provider
notifications or persistence of the counters is enabled by instrumentation.

## Explicitly opt-in Postmark alerts

Alerts are **off by default**; disabled runs do not read mail configuration.
Enabling `-postmark-alerts` also requires `-mail-timeout` (positive, at most10s)
and `-mail-min-interval` (1m–24h). All four environment values must be available
to the monitor process: `POSTMARK_SERVER_TOKEN`, `POSTMARK_FROM_EMAIL`,
`POSTMARK_MESSAGE_STREAM` and `ADMIN_NOTIFICATION_EMAILS`. This command does not
load the game's `.env` or configure systemd for you. The operator recipient list
is comma-separated bare addresses (at most50); its To header is visible to those
recipients, so include only intended operators. It is never used for player
recovery links. No credentials belong in command-line arguments or public logs.

The adapter uses the fixed verified-HTTPS `/email` endpoint and authentication
contract from the [Postmark email API](https://postmarkapp.com/developer/api/email-api),
with no redirects, tracking, attachments or arbitrary report text. Sender/stream
eligibility and inbox delivery still need operator verification. Responses are
bounded to8KiB and require an explicit zero ErrorCode and MessageID. Event output
adds `delivery`: `accepted` means a provider receipt, **not inbox delivery**;
`unconfirmed` covers rejection, timeout or ambiguous acknowledgement;
`suppressed` means the global attempt interval prevented a request.

That interval applies to *all* attempts, including failures and rapidly flapping
outage/recovery transitions, independently of reminder cooldown. Suppressed
notices still appear on stdout but are not queued. A recovery immediately after
an outage can therefore have its email suppressed. There is no automatic retry
of an ambiguous message; a later eligible reminder is a new attempt. Sending
is synchronous and bounded by the chosen timeout, so polls may be delayed by it.
The attempt clock and incident state are RAM-only and reset on restart; supervisor
restart policy and off-machine monitoring matter for reliable/cost-bounded operation.

No production alerts or service are installed by this code. Alert ownership,
actual provider/inbox verification, retention, restart policy and budget agreement
remain required before completing the operations milestone. A blocked output
pipe can still require termination; configure a supervisor and output policy
when installing the independent monitor.
