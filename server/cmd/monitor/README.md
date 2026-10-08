# Independent readiness monitor

Delivered and enabled in production with Alpha 1.78 using the owner-approved
settings recorded below; reverified running on October7. Build with
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

## Optional public login and API checks — prepared, not enabled

The command can additionally accept both `-public-frontend-url` (an exact HTTPS
`/release.json`) and `-public-backend-url` (an exact HTTPS `/healthz`). Both are
required together, without credentials, queries or fragments; redirects are
refused and ordinary TLS/DNS remain enabled. Empty defaults keep the currently
installed local-only monitor unchanged. This code preparation does not change
private environment values, recipient policy or production activation. The
prepared Compose command maps `EIDOLON_MONITOR_PUBLIC_FRONTEND_URL` and
`EIDOLON_MONITOR_PUBLIC_BACKEND_URL` to those flags, with empty defaults. Set
both only after approval; the normal exact-command configuration preflight
rejects malformed/partial configuration before replacing the API. Disabled
monitoring does not build/start the optional service or validate its unused
public settings.

After a healthy baseline API observation, the optional check reads the frontend
origin's `/`, its release manifest and the public backend health endpoint. The
page must contain the current login controls; the manifest, public backend and
baseline backend must agree on commit/version, and the public backend must report
database readiness. Login HTML is capped at1MiB and each JSON response at32KiB.
The three public requests share one `-request-timeout` deadline, in addition to
the baseline request's existing timeout. With5s configured, HTTP observation can
therefore take up to approximately10s, not20s; optional storage/mail waits remain
separate. The optional latency budget now measures that whole HTTP observation,
so choose it accordingly rather than reusing a local-only budget blindly.

Fixed public causes use the ordinary failure/recovery debounce and cooldown.
Output/email adds only five boolean coverage/readiness fields under `public`;
it never includes endpoint URLs, page bodies, arbitrary TLS/DNS errors or account
data. Cancellation remains a shutdown, not an outage. Configuration-check mode
validates these flags without network or mail IO.

This is structural HTTP availability, not execution of browser JavaScript or a
Firefox/gameplay test. From the game host it can detect its observed public route,
but not establish off-machine reachability, every IPv4/IPv6 route, or availability
when the host itself fails. Owner-approved independent/off-machine coverage and
safe deployment-transition/recovery exercises remain open. Exact source and
read-only current-public checks are recorded in
[the preparation receipt](../../../docs/plans/2026-10-08-public-monitor-checks.json).
The managed Compose/compiled-command path is separately qualified in
[the service receipt](../../../docs/plans/2026-10-08-managed-public-monitor-checks.json).

Reversible configuration uses the existing normal deployment flow after this
code is accepted: paired public settings enable the observations; clearing both
and recreating **only the monitor** returns it to local-only observation without
stopping API/Mongo. Editing `.env` alone does not reconfigure a running process.
Do not install these settings into an older monitor binary that lacks the flags;
use a qualified matching code/Compose artifact. Never print private Compose or
environment output. During an ordinary frontend/backend staggered deployment,
identity mismatches are failures under the unchanged debounce policy; qualify
that transition before enabling, not by suppressing or inventing healthy probes.

## Optional pressure budgets

All pressure checks are **disabled by default**. An operator can explicitly set
`-max-probe-latency` (positive, no greater than the request timeout),
`-max-heap-bytes`, `-max-goroutines`, `-max-inflight-calls`, or
`-queue-alert-percent` (1–100). Zero disables the corresponding check. These
are external alert controls, not limits enforced on the game or capacity claims.
Choose them from representative measurements and an agreed operating budget;
this preparation does not choose thresholds or enable a production monitor.

Latency includes the whole request and response-body read. Heap, goroutine and
total active-call checks trigger **above** their maximum; either broadcast queue
triggers **at or above** its chosen percentage (rounded up to a whole entry).
Active calls sum the six instrumented groups, so nested operations can count
more than once; this is not a player, transaction, waiter or entitlement count.
Missing required metrics or zero queue capacities report `metrics_unavailable`,
never a measured idle/healthy result. Pressure notices use the same consecutive
failure/recovery and cooldown settings as readiness incidents. Existing HTTP,
database, identity, timeout and cancellation failures retain precedence. Historical
failure totals and lifetime latency maxima cannot establish recovery and do not
trigger these pressure alerts. Default probes remain compatible with older servers.

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

## Optional local filesystem headroom

Storage reads are **off by default**. `-storage-path` selects one absolute path
on the filesystem to observe, and requires `-storage-timeout` (positive, at most
10s). This observes the monitor's own mount namespace, not the machine serving
a remote health URL. Run on the host with the intended data mount, or mount it
explicitly into the monitor container; a container's unrelated root filesystem
does not establish database/journal headroom.

With no floors, the selected filesystem is observed without a low-space alert.
Optional `-min-storage-free-bytes` and `-min-storage-free-percent` (1–100) trigger
when available space is **below** either chosen floor; exact equality is allowed.
Zero disables each floor. Floors without a path, a path without a timeout or
invalid settings reject generically. Operators must choose the path and budgets;
no production path or disk threshold is selected by this implementation.

On Linux this makes one read-only filesystem-statistics call for that path,
not a directory scan, file-content read or Mongo query. It uses fragment/block
units and available space excluding the superuser reserve, following
[Linux filesystem statistics](https://man7.org/linux/man-pages/man2/statfs.2.html)
and [GNU filesystem usage conventions](https://github.com/coreutils/gnulib/blob/master/lib/fsusage.c).
Only `storage.totalBytes` and `storage.availableBytes` may enter incident output
or operator email; paths, mount IDs and kernel error text remain private. These
numbers are mount-wide headroom, not database/collection/log/journal size, quotas,
growth forecasts, inode availability, writable-state or storage-throughput proof.

Missing, unsupported, invalid or failed measurements report `storage_unavailable`,
not a healthy zero. A bounded wait reports `storage_timeout`; low space reports
`storage_budget`. Both successful measurements and failures are fresh observations,
never cached healthy results. Incidents use ordinary debounce/cooldown/recovery.
Existing HTTP/database/identity/runtime failures retain precedence; cancellation
stops waiting and is not an outage. Request latency remains the HTTP observation;
the storage wait is separate and can delay polling by its explicit timeout.

A kernel filesystem call cannot itself be cancelled. At most **one** read per
probe can remain in flight; subsequent polls report unavailable without starting
more workers until it returns. Caller cancellation does not wait for that worker,
and its late result is discarded. This does not guarantee that an unhealthy
kernel/mount can be interrupted or recovered without operator intervention.
Other platforms report unavailable if this optional Linux check is enabled.

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

The command itself does not install a service. A blocked output pipe can still
require termination; configure a supervisor and output policy when installing it.

## Approved Linux Compose service

The separate `monitor` image/service uses the `operations` profile. It has no
API dependency or listener, runs non-root with a read-only root filesystem and
no capabilities, and observes the configured host-loopback API upstream. It is
independent of the game container, not of Docker, the host or its network.
It intentionally does not pin a release commit, so a normal release transition
does not itself become an outage. It monitors local API/database readiness,
not public DNS, TLS, frontend availability or off-machine network reachability.

On October6 the owner approved existing `ADMIN_NOTIFICATION_EMAILS` ownership,
current self-hosting/Postmark and these explicit settings: 30s polling, 5s
requests, three failures, two recoveries, 30m reminder cooldown, 10s mail timeout
and a shared 1m minimum between mail attempts. A single separately labelled
manual mail test reached the owner's inbox. Pressure/storage limits remain off;
there is no new paid service or player/provider retention change.

To opt in, set `EIDOLON_MONITOR_ENABLED=true` in the private server `.env`.
The normal deployment script builds the monitor and runs its exact configured
command with `EIDOLON_MONITOR_CHECK_CONFIG=true` before replacing the API. That
mode performs all local configuration/notifier validation, then exits silently
without making any probe or email request. An invalid check-mode value refuses.
The script starts/updates the independent monitor after API readiness succeeds.
Missing mail configuration or an unavailable logging driver prevents its setup;
do not dump Compose configuration or container environments into shared logs.

`restart: unless-stopped` survives normal process exits and daemon restart, but
a manually stopped monitor remains stopped until explicitly started. Incidents
go to the existing host journald driver with tag `eidolon-monitor`, preserving
records across container recreation subject to the host's existing journal
rotation/retention policy. This is not a guaranteed number of days, infinite
storage, backup or player audit history. No shared journal policy is changed.
Healthy probes do not produce log lines or email; restart resets debounce/rate
state. Inspect only the monitor using:

```sh
docker compose --profile operations ps monitor
docker compose --profile operations logs --tail=30 monitor
journalctl -t eidolon-monitor --since today --no-pager
```

To pause alerts reversibly, set `EIDOLON_MONITOR_ENABLED=false`, then explicitly
stop only that service with `docker compose --profile operations stop monitor`.
Changing the flag alone does not stop an already running independent monitor.
Do not stop the API/Mongo or delete their logs. Re-enable by setting the flag to
true and using the normal deployment flow (or the profile's explicit monitor
build, configuration-check and `up -d --no-deps monitor` commands).
