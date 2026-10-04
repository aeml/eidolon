# Load driver and capacity evidence

Prepared1.79 instrumentation; this is not production-capacity acceptance. Run
only against an explicitly isolated disposable server/database or an approved
target. Default-generated account credentials stay in memory; optional supplied
credentials are read-only. The driver creates accounts and changes synthetic
characters through normal commands, so it is not a read-only production probe.

`-scenario` currently supports `combat`, `town`, `social` and `mixed`. Mixed assigns
those three profiles round-robin. It does **not** exercise seated casino wagering,
coordinated dungeon/raid parties or all world-event flows; all of those remain
separate required workloads before the1.79 milestone can be accepted. Registration,
login and join now wait for their actual acknowledgements, with a bounded
`-admission-timeout` per phase (default15s, allowed100ms–60s). Existing-account
registration refusal is followed by real login; the acknowledged existing class
is preserved. Missing, rejected, busy, malformed and out-of-order replies fail
rather than silently retrying or bypassing account limits. The100ms launch stagger
still defines the launch profile; it is not a credential-burst certification.
Commands sent are not proof they were accepted.

The final `Load summary` includes connection/admission counts, aggregate decoded
state frames, and read/write/**decode** errors. Admission requires a snapshot
containing that client's own Player entity, not just a sent join or other actors.
`Admission coverage` requires every configured client to authenticate without
startup failures and reports maximum registration, login and join acknowledgement
latencies. Operator cancellation is separate from admission failure; intentional
local reader cleanup is not counted as a network read error. Actual unexpected
remote closure remains a read failure. Writes have a five-second deadline.
Bots also retain the received movement/recovery context, seed monotonic movement
sequences from authoritative state and limit each200ms walking step to reported
speed. Missing context or invalid/dead actor state sends no movement. Dead bots
request normal context-bound respawn once, then wait for an alive snapshot.
This corrects post-recovery movement, but does not make sent moves proof of
accepted travel or provide collision/pathfinding or encounter-clear evidence.
The additional `State coverage` line reports:

- clients with at least one own-player state observation;
- minimum own-player frames and first-to-last observation window across **all**
  configured clients, including zero for unobserved clients;
- maximum observed gap between successive own-player state frames;
- total received message payload bytes before gzip expansion, excluding
  WebSocket framing, TLS/IP overhead and sent traffic.

Measurements are fixed per configured client and hold no account identifiers or
actor histories. Socket readers terminate before final totals are read. Protobuf,
legacy JSON and gzip state frames are covered; malformed messages count as decode
failures. Reads and decompression are bounded to8MiB per message. Clients with
zero or insufficient coverage cannot be hidden by the others' aggregate traffic. These observations
still do not prove action acceptance, Internet latency, render FPS or gameplay.

The existing isolated nightly runner now requires exactly one complete summary
and both coverage lines, no read/write/decode/admission failures, all100 clients
authenticated and covered, and
safe-integer, ready, same-run runtime samples. `SOAK_MIN_CLIENT_STATE_RATE`
predeclares a positive per-client frame rate (at most60; default5 retains the
previous accepted aggregate baseline as a stricter every-client test gate).
Every client must reach that rate over the configured duration and cover at
least90% of the requested duration. Memory/goroutine/growth ceilings are unchanged.
The maximum state gap and received bytes are reported, not given an invented SLA.
Old accepted load receipts retain their original scopes; missing new fields do
not retroactively invalidate those historical runs or justify replaying them.

Predeclare the workload, duration, acceptable tick/network/database/client
metrics and headroom before a representative capacity run. Reuse compatible
existing checks and run only the remaining scoped workloads, not another full
campaign or arbitrary24-hour soak on every version.
