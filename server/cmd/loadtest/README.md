# Load driver and capacity evidence

Prepared1.79 instrumentation; this is not production-capacity acceptance. Run
only against an explicitly isolated disposable server/database or an approved
target. Default-generated account credentials stay in memory; optional supplied
credentials are read-only. The driver creates accounts and changes synthetic
characters through normal commands, so it is not a read-only production probe.

`-scenario` supports `combat`, `town`, `social`, `mixed`, `casino-slots` and
`casino-blackjack`. Mixed
still assigns only combat/town/social round-robin. It does **not** exercise casino
wagering, coordinated dungeon/raid parties or all world-event flows; those remain
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

## Public slot-machine workload

`-scenario casino-slots -n 1..32 -credentials-file /absolute/test-accounts.json
-casino-bet 20 -duration 90s` uses one distinct physical public/Gold machine per
bot. Every bot needs a supplied test account with an existing funded character
in town or on the public casino floor. Do not use production accounts without
explicit approval. Stake must be20–100000 in steps of20. The driver neither grants
currency nor tops up losses, changes VIP/EP access, forces bonuses or invents
machines. Declare duration and funding for the actual route/action workload;
the example90s is not a capacity SLA.

Bots approach the town door, enter via the ordinary casino command, walk to
their assigned machine and sit before wagering. At most one monetary action
is outstanding. A new spin or bonus choice uses the current private session and
round revision; unchanged polls/broadcasts are not completion. The next exact
revision with a settled outcome acknowledges completion; bonus choices also
require the selected result. Normal free spins and bonuses are handled with
three-second action pacing. Rejections, timeouts, revision gaps, changed seat
sessions, EP/VIP state and insufficient paid-spin Gold fail without uncertain
retries, raw account edits or refunds.

`Casino coverage` reports minimum acknowledged total and **paid** spins across
every client, total completed spins/bonus choices and failed controllers. Exit
success requires at least one acknowledged paid Gold spin per client and no
controller failures, alongside
the ordinary transport/admission checks. This is protocol outcome evidence, not
rendered slot animation, independent wallet/payout conservation, collision-route
coverage or save-after-restart proof. Local socket stand-ins are not real-game
capacity acceptance. Card-table workloads and a representative combined profile
still need implementation; the32 public machines do not imply a100-slot-player
capacity promise. The existing100-client nightly validator remains for the
combat/town/social mixed profile, not this separately reported workload.
At shutdown bots stop issuing actions, observe any one outstanding spin/bonus
acknowledgement for at most the declared admission timeout, then close and join
their reader. Missing final acknowledgement fails instead of silently passing.

## Multiplayer blackjack workload

`-scenario casino-blackjack -n 1..24 -credentials-file /absolute/test-accounts.json
-casino-bet 20 -duration 120s` assigns six distinct chairs at each of the four
public Gold blackjack tables. It uses the same approved funded-account,
door/entry/walking/seating and legal Gold-stake rules as slots. Declare a duration
that covers travel, the normal betting window, turns and settlement;120s is an
example, not measured capacity or a promised SLA. Multiple bots at a table share
the real table; no NPC substitutes, rigged decks, wallet grants or VIP/EP access.

Bots submit one wager for the exact current round and private seat, wait for
their own funded participant entry, then stand only when that player's advertised
turn offers `stand`, using the current shared revision. Another player's wager,
turn or revision advance cannot count as the bot's own accepted bet or finished
hand. Observed stands require own-hand completion plus revision progress; the
counter is deliberately not causal acceptance proof, because a server timeout
can also finish a hand. Any explicit late rejection still fails the workload.

Completed-round evidence requires a newly acknowledged bot wager for that exact
round, a completed hand with a known nonnegative outcome and the bot's own paid
participant flag. Existing history, dealt hands, unconfirmed payouts, duplicate
snapshots and other players' outcomes do not count. `Blackjack coverage` reports
accepted wagers, paid completed rounds, minimum paid completions across every
client, observed stands and failures. Every bot must complete at least one newly
funded paid round to pass. Stale/wrong-session/round/bet, uncertain acknowledgements,
late rejections and underfunding fail without monetary retries.

Shutdown observes only the last outstanding request acknowledgement within its
bound, not an entire newly funded table round; accepted ongoing wagers remain
under normal server timer/persistence rules. This does not prove all last rounds
settled after disconnect, payout conservation, durability or production load.
Focused local bot/WebSocket fixtures are not actual game/Mongo acceptance.
Poker, roulette, baccarat, coordinated parties/raids, events/save and representative
combined workloads remain required before the capacity milestone is complete.

Predeclare the workload, duration, acceptable tick/network/database/client
metrics and headroom before a representative capacity run. Reuse compatible
existing checks and run only the remaining scoped workloads, not another full
campaign or arbitrary24-hour soak on every version.
