# Load driver and capacity evidence

Prepared1.79 instrumentation; this is not production-capacity acceptance. Run
only against an explicitly isolated disposable server/database or an approved
target. Default-generated account credentials stay in memory; optional supplied
credentials are read-only. The driver creates accounts and changes synthetic
characters through normal commands, so it is not a read-only production probe.

`-scenario` supports `combat`, `town`, `social`, `mixed`, `casino-slots` and
`casino-blackjack`, `casino-house`, `casino-poker`, `party-combat` and `combined`. Mixed
still assigns only combat/town/social round-robin. It does **not** exercise casino
wagering, coordinated dungeon/raid parties or all world-event flows. The separate
combined profile below covers combat/casino/save at20; dungeon/raid/event and
declared capacity acceptance remain open. Registration,
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

- clients receiving a decoded view while their own Player is present;
- minimum delivered view frames and first-to-last observation window across **all**
  configured clients, including zero for unobserved clients;
- maximum observed gap between successive delivered view frames;
- total received message payload bytes before gzip expansion, excluding
  WebSocket framing, TLS/IP overhead and sent traffic.

Measurements are fixed per configured client and hold no account identifiers or
actor histories. Socket readers terminate before final totals are read. Protobuf,
legacy JSON and gzip state frames are covered; malformed messages count as decode
failures. Reads and decompression are bounded to8MiB per message. Clients with
zero or insufficient coverage cannot be hidden by the others' aggregate traffic. These observations
still do not prove action acceptance, Internet latency, render FPS or gameplay.
In delta replication, the player's own entity can be cached while only peers
change (or an idle delta arrives). These still count as delivered view frames,
not fresh own-state updates. A separate `Own state coverage` line reports clients
with a freshly received own Player and minimum fresh updates across all clients.
It counts explicit own entities in protobuf full/delta or legacy full snapshots,
not cached entities or removals. Every client requires at least one fresh update;
there is no invented own-update rate for unchanged idle players.

The existing isolated nightly runner now requires exactly one complete summary
and each coverage line, no read/write/decode/admission failures, all100 clients
authenticated and covered, and
safe-integer, ready, same-run runtime samples. `SOAK_MIN_CLIENT_STATE_RATE`
predeclares a positive per-client frame rate (at most60; default5 retains the
previous accepted aggregate baseline as a stricter every-client test gate).
Every client must reach that rate over the configured duration and cover at
least90% of the requested duration. Memory/goroutine/growth ceilings are unchanged.
The rate/window gate measures delivered views, not fresh own-state updates.
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
capacity acceptance. The separate combined check below covers actual card tables
and slots at20 total clients, not all machine seats; the32 public machines do not imply a100-slot-player
capacity promise. The existing100-client nightly validator remains for the
combat/town/social mixed profile, not this separately reported workload.
At shutdown bots stop issuing actions, observe any one outstanding spin/bonus
acknowledgement for at most the declared admission timeout, then close and join
their reader. Missing final acknowledgement fails instead of silently passing.

## Shared table polling

Blackjack, roulette/baccarat and poker bots refresh an idle table view through
read-only `get` requests at the normal client's three-second cadence. A valid
cached lobby or peer-turn view can become stale as the server clock advances;
it is not a continuing subscription. Refreshes neither retry a monetary action
nor count as a wager, turn or paid result. There is no query while an action is
outstanding, and no duplicate query when a child controller already refreshed.
Query write failures fail the workload.

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
The separate combined check below covers party combat, tables and normal saves;
dungeon/raid/event and declared capacity acceptance remain open.

## Shared roulette and baccarat workload

`-scenario casino-house -n 1..36 -credentials-file /absolute/test-accounts.json
-casino-bet 20 -duration 120s` assigns distinct public Gold chairs across four
six-seat baccarat tables and two six-seat roulette tables. It uses the same
funded-account, legal stake and physical entry/seating rules above. Duration must
cover travel, ordinary betting, reveal and settlement windows;120s is only an
example, not a capacity result. Bots wager on baccarat `player` or roulette `red`
through the normal validated command, without rigging results or granting funds.

A sent wager counts only after the exact owner's seat/round/single stake is
acknowledged. Reveals are not payment: fresh completion requires the newly
funded round, the owner's paid flag, nonnegative payout and a valid roulette
number or baccarat winner. Existing history, peer wagers, unpaid results and
duplicate views cannot satisfy coverage. Changed sessions, wrong rounds/stakes,
EP state, rejections, insufficient funds and timeouts fail without money retries.

`House coverage` reports accepted wagers, paid completed rounds, minimum fresh
paid rounds per client and failures (`observed_stands=0` is unused for these
games). Every configured bot needs at least one fresh paid round. Shutdown drains
only the outstanding request acknowledgement, not every final funded round;
ongoing rounds remain under normal server timer/persistence rules. Local socket
fixtures verify both games through two accepted wagers and one paid round, with
the second round still pending settlement. They do not prove actual-game/Mongo
travel, wallet conservation, multiplayer capacity or restart durability. The
default mixed workload and100-client nightly validator remain unchanged.

## Player-only Hold'em workload

`-scenario casino-poker -n 2 -credentials-file /absolute/test-accounts.json
-casino-bet 100 -duration 120s` assigns public Gold poker chairs, six per table,
with the same normal physical approach and funded-account requirements. Valid
counts are2–24 except7,13,19, which would leave a lone player at the final table.
There are no house opponents. Gold buy-in is100–100000 in steps of100; specify
it explicitly because the other games' default20 is not a legal poker buy-in.
The example duration is not measured capacity: allow travel, shared betting,
all betting streets and settlement under normal timers.

Bots acknowledge only their exact own seat/session/round buy-in, then check or
call only on their advertised own turn, using the current revision. No raises,
rigged cards, forced deals, bankroll grants, VIP/EP use or uncertain money retries.
Peer-only revision progress cannot acknowledge an unchanged own turn. Observed
turn progress is not causal action proof, since timeouts can also check. Names,
hole cards, decks and hand descriptions are omitted from the retained view.

`Poker coverage` reports accepted buy-ins, fresh paid completed rounds, minimum
paid rounds across every bot, observed turns and failures. Fresh completion needs
a previously acknowledged own buy-in, a real two-or-more-player completed hand,
the own participant paid flag and nonnegative own payout. History, a lone funded
lobby, showdown without payment, peer results and duplicates do not count.
Shutdown observes outstanding requests, not all last funded rounds; normal server
cash-out/recovery remains authoritative. Focused checks play a two-controller hand
through the actual poker rules with the ordinary shuffled deck and advertised
revision-bound actions. This is domain/protocol evidence, not actual-server socket,
wallet persistence, multiplayer capacity or restart acceptance. Representative
combined capacity, dungeon/raid/event and restart acceptance still remain required.

The separate opt-in `TestLoadPokerActualEntryPlayAndCashOut` now passes with two
real bots, production-style server/driver and disposable Mongo: town-door entry,
walking to distinct chairs, shared shuffled hands, newly funded paid completion
for both, then normal reconnect/leave and durable cash-out. Total Gold remains
2468 and gear, bags and EP are unchanged. Use the same isolated environment
flags documented below. The90s workload is opt-in, not repeated automatically
on every release, and does not establish24-seat/four-table or100-player capacity.

An initial race-instrumented1GiB fixture hit its memory limit; a same-budget
production-style run exposed the stale-view polling bug above. Corrected bots
passed without increasing duration/budget or relaxing paid-round evidence. Use
production-style binaries for representative resource measurements; race runs
remain scoped concurrency evidence, not production-capacity measurements.

## Four-player overworld party workload

`-scenario party-combat -n 4 -credentials-file /absolute/test-accounts.json
-party-combat-x X -party-combat-z Z -duration 120s` uses prepared existing
characters, ordered Fighter, Cleric, Rogue, Wizard in each group of four.
Counts must be4–100 in multiples of four. Coordinates must explicitly identify
an approved overworld combat site. Accounts must be distinct, outside instances
and not already in a party. Do not use live player accounts without approval.
This profile preserves equipped gear and inventory; it never creates/reclasses
characters, auto-equips, sells, picks up items or grants stats/currency. Casino
profiles now also bypass the legacy combat bot's inventory mutations.

The Fighter invites the other three through normal nonce-bound consent; every
client must receive its own full four-member roster. Followers stay near the
Fighter, and the Cleric uses unlocked Healing Light on wounded nearby allies.
Each member uses normal class attacks/abilities, one outstanding ability request
at a time, with actual acceptance/denial and reported cooldowns. No forced hits,
heals, kills, unlocks or bypassed cooldowns. Normal death/respawn behavior remains;
this is not dungeon traversal, encounter AI or a complete recovery route.

`Party coverage` separately reports confirmed groups/members, minimum own
positive damage/heal deliveries per member, aggregate deliveries, accepted and
denied casts, observed XP progression and observed target deaths. Success needs
all four-member rosters and at least one own positive impact per client, alongside
transport/admission/state coverage. Deliveries are not unique action receipts;
the protocol exposes no per-kill party-credit receipt. XP changes and dead target
observations are not attributed shared kills, rewards or save acceptance. A
Cleric's damage alone can satisfy impact coverage, so success is not proof of
healing-role viability. Shutdown bounds the final outstanding cast receipt and
joins every reader.

The local four-socket fixture uses real party creation/invitation/consent rules
but synthetic ability results and impacts. It verifies distinct class inputs,
healing selection, consent, inventory preservation and shutdown, not actual
game-server combat, Mongo persistence, dungeon/raid clears or multiplayer capacity.
Actual combat/save evidence follows; dungeon/raid and declared capacity remain open.

The separate opt-in `TestLoadPartyActualCombatAndSavedGear` now verifies the
current profile against the normal race-built server and disposable Mongo:
four equipped level30 characters fight ordinary randomized enemies for45s,
receive actual class impacts and Cleric healing, then save positive XP for every
member while preserving equipment, bag and EP exactly. Enable only with
`EIDOLON_RESOURCE_DISPOSABLE_DATABASE=1`, an explicitly isolated loopback
`EIDOLON_RESOURCE_MONGO_URI`, absolute `EIDOLON_RESOURCE_BINARY` and
`EIDOLON_LOADTEST_BINARY` paths. This earned-combat/save check is not a dungeon or
raid clear, unique per-kill receipt, fresh-process reload or100-player capacity
result. It is opt-in, not an automatic repeated45s run on every release.

## Concurrent combined workload

`-scenario combined -n 20 -credentials-file /absolute/test-accounts.json
-casino-bet 100 -party-combat-x X -party-combat-z Z -duration 120s` runs20–100
clients in fixed twenty-account blocks. All accounts must be distinct and have
prepared existing characters. Each block, in credential order, contains:

| Account positions (one-based) | Workload |
| --- | --- |
| 1–4 | Fighter, Cleric, Rogue, Wizard overworld party |
| 5–6 | Player-only poker |
| 7–10 | Multiplayer blackjack |
| 11–12 | Baccarat |
| 13–14 | Roulette |
| 15–16 | Distinct public slot machines |
| 17–18 | Town walking/chat attempts |
| 19–20 | Town/social registry-read/chat attempts |

The explicit100Gold stake is legal across all included casino games. Declare
enough initial disposable-account funding for the duration, not wallet top-ups
or artificial wins. Party members must be outside instances and existing parties;
casino participants start in town/public casino, and town/social participants in
town. The normal entry/seat/consent/ability/cooldown rules remain unchanged. Every
role preserves class gear and bags; no legacy auto-equip, sell or pickup behavior.
No house-filled poker opponents or shared/reused casino chairs are invented.

Each `Combined casino coverage` line includes the assigned clients, accepted
wagers (slots: acknowledged paid spins), paid results, minimum paid results across
every assigned client, observed actions, bonus completions and failures. Every
casino participant needs at least one fresh paid result. The separate party
coverage gate still requires all four-member roster views and every member's own
positive impact. Global transport/admission/fresh-state checks include all clients,
not only the busiest roles. Town/social allocation and state coverage do **not**
prove chat/read action acknowledgements or accepted walking distance.

`TestLoadCombinedActualConcurrentWorkloadsAndSaves` passes one bounded20-client,
120s production-style server/driver run on an owned disposable Mongo: concurrent
party impacts/healing and paid poker/blackjack/baccarat/roulette/slot results,
followed by fresh normal saves for all twenty, exact gear/bag/EP preservation and
saved XP for each party member. It reuses the preceding prepared class gear and
build setup; no whole-campaign or repeat of accepted individual workloads.
Use the opt-in isolated environment flags above. The default mixed/nightly100
profile remains unchanged. Final funded casino rounds can remain in normal
durable recovery; this is not full final settlement, raid/event participation,
renderer/Internet latency, runtime/DB headroom or100-player capacity acceptance.

Predeclare the workload, duration, acceptable tick/network/database/client
metrics and headroom before a representative capacity run. Reuse compatible
existing checks and run only the remaining scoped workloads, not another full
campaign or arbitrary24-hour soak on every version.
