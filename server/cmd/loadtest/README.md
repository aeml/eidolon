# Load driver and capacity evidence

Prepared1.79 instrumentation; this is not production-capacity acceptance. Run
only against an explicitly isolated disposable server/database or an approved
target. Default-generated account credentials stay in memory; optional supplied
credentials are read-only. The driver creates accounts and changes synthetic
characters through normal commands, so it is not a read-only production probe.

`-scenario` supports `combat`, `town`, `social`, `mixed`, `casino-slots` and
`casino-blackjack`, `casino-house`, `casino-poker`, `party-combat`, `party-dungeon`,
`party-raid`, `party-event` and `combined`. Mixed
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
request normal respawn once with a fresh cryptographic nonce, like the real
client, not the current movement context (which game authority rejects).
Walking stays disabled until the server echoes that nonce and a subsequent fresh
own-player state shows alive in Lanternhold. A stale echo, missing nonce/state
acknowledgement or expiry at the declared admission timeout fails without retry.
`Recovery coverage` reports configured clients, requested/completed recoveries,
pending clients and failed clients; final success requires no pending/failures
and every requested recovery completed. The nightly validator requires that line
even when no recovery occurs; historical receipts keep their original scope.
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

Party scenarios also emit four fixed `Party role coverage` rows, one for each
class. They report participants, confirmed membership, minimum actual impacts,
damage/heal events and accepted/denied casts. Zero-impact participants remain in
the minimum; accepted casts alone do not count as impact. These diagnostics do
not relax the every-player impact gate or establish encounter/capacity success.

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

## Equipped four-class dungeon workload

`-scenario party-dungeon -n 4 -credentials-file /absolute/test-accounts.json
-dungeon-type verdant_bastion_catacombs -dungeon-level 30
-dungeon-difficulty normal -duration 12m -admission-timeout 5s`
uses the same consenting Fighter/Cleric/Rogue/Wizard account order and prepared
class-appropriate gear as party combat. Counts are4–100 in groups of four, not
a100-player capacity result. Every account needs an existing qualified character
outside an instance/party; no character is created, equipped, sold or reset.
Specify an unlocked regional run band at or above that dungeon's minimum.
Normal/heroic/mythic qualifications and Umbral story gates stay server-owned;
raids use a different ready-check flow and are not included here.

After normal invitations and all four roster views, every member requests the
ordinary dungeon status and refuses any existing run. Only the leader starts a
fresh run, once. Every member must receive the same bounded validated canonical
layout and a fresh own-player entry state before combat. The party follows the
first uncleared objective room using overlap portals between canonical floor
rectangles. Segment-union checks prevent direct movement/casts/heals through
missing floor space; actual walking still obeys normal reported speed, context
and sequence. This is not telegraph dodging, full encounter tactics or renderer
pathfinding acceptance.

The normal class/target/healing/cooldown controller fights without forced spawns,
kills, stat scaling, mana refills or cooldown bypass. At under25% Health or15%
Mana, living characters Recall normally (not health-refilling unstuck Respawn).
Dead characters use normal Respawn. Both wait for fresh nonce/town acknowledgement;
reentry waits for at least90% Health and Mana from ordinary safe-zone regeneration,
uses the same run and verifies its unchanged layout and latest contiguous cleared
boss checkpoint. No reset or fifteen-minute logout-policy change is introduced.

`Dungeon coverage` includes each configured member's own entry, full room-clear
view and alive town exit, plus per-group cleared rooms/bosses, requested reentries
and acknowledged checkpoint returns. A peer's clear, historical run, changed
scene/layout, regressed progress, missing acknowledgement or incomplete exit
cannot pass. Final clear requires all nonstart rooms cleared in every member's
own current-run view; every member then Recalls once. Existing party impact and
global fresh-state/admission/recovery/error gates also remain required.

The duration is a maximum for this earned-clear check, not a minimum soak window.
Bots finish after every cohort member clears and exits, or on cohort failure;
once all bot workers finish, the command ends rather than waiting out its timer.
An unfinished run at the bound fails; do not increase time or fabricate clears
to turn it green. Default mixed/nightly workload remains separate.

Focused controller cases use explicit room/response/checkpoint fixtures, not
earned clears. Separate routing checks traverse every room in actual generated
Earth/Water/Fire/Air layouts. The opt-in root
`TestLoadDungeonActualFourClassClearExitAndSaves` now passes once against an
isolated production-style server/driver and Mongo, with uncommon/rare class gear
and a12-minute maximum, ending after about five minutes. All four members clear
ten rooms/four bosses and exit, with12 confirmed town recoveries, eight unchanged-run
checkpoint returns and35 actual healing deliveries. Independent Mongo checks
confirm every participant's durable
original boss receipts, saved XP, protected bag item, gear and EP after ordinary
town exit. The owned fixture and synthetic database were removed after terminal
success. This is one actual normal Verdant clear, not all regional encounters. It is
not an automatic campaign/soak on every release, raid clear,100-player capacity,
fresh-process replay or human pacing proof.

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

The staged elemental-raid controller now supports bounded5–10-player cohorts
with repeated Fighter/Cleric/Rogue/Wizard roles. It waits for the normal leader
conversion response before further invitations, then requires every player's
own full-roster ready-check view, affirmative ready request, readiness
acknowledgement and final all-ready view. Missing replies time out without
retry; changed cohorts, unsolicited/revoked readiness and contradictory views
fail. The normal four-player party/dungeon constructors remain four-player.

`TestRaidPreparationNormalDomainConversionAndEveryConsent` exercises five and
ten participants for all four elemental raid definitions using the actual game
party conversion, ready-check and raid-access methods with synthetic protocol
responses. This is controller/domain preparation evidence, not a production
WebSocket/server, dungeon/raid clear, crystal repair or save check. Preparation
alone sends no movement, encounter or reward actions.

The following candidate now connects `-scenario party-raid -n5` (one group,
5–10 clients) with `-raid-type earth_crystal_raid|water_crystal_raid|fire_crystal_raid|air_crystal_raid`.
Supply distinct qualified prepared saves in repeated Fighter/Cleric/Rogue/Wizard
order. No character creation, gear replacement, sale or pickup. Normal raid
launch enforces dungeon-chapter access and realm entry level30/60/70/70.
Ordinary Recall/Respawn, town recovery and same-run checkpoint return are reused.
Fresh raid scene metadata normally omits spawn; later own state must confirm
the server's start-room position, and reentry retains explicit checkpoint checks.
No transform, kill, cooldown, repair or reward is fabricated by this workload.

Each client must observe the instance-bound crystal and all three live waves
before restoration can pass. Boss/assault clear alone never permits an exit.
Marker-driven roles defend the Earth ward, carry Water memories, hold ordered
Fire vents and alternate Air bearers, using ordinary movement and the normal
worker's progress. Every client must observe restoration and exit alive in town.
`Raid coverage` separates conversion/readiness, wave views and restored members
from assault room counts. The selected duration is a maximum, not an accepted
soak window: the driver ends on every-client completed exit or failed cohorts.

`TestLoadRaidActualFiveClassRolesRepairExitAndSaves` uses the normal server,
five level30 class roles with uncommon/rare gear, and disposable prequalified
chapter fixtures. Independently require original shared boss reward receipts,
saved XP/gear/bag/EP, fresh town saves, and earned repair quest readiness for
every participant **without** auto-completion or granted quest rewards. Its
first attempt failed before formation because the solo roster preceding an
invite exposed a conversion/acceptance ordering deadlock. That is corrected
and included in the preparation regression. The clean corrected attempt passed
535.31s, ending early after the full earned Earth clear, three-wave repair and
all-five town exits. Independent saves confirm original shared boss rewards,
earned repair readiness without auto-claiming, positive XP and preserved gear,
bag sentinel and EP for every member. Forty healing deliveries,23 confirmed
recoveries and18 validated unchanged-run checkpoint returns were observed.
The whole isolated fixture peaked at578002944B with no OOM; this is not game-heap
or capacity/headroom evidence. Luna monitored the exact process; parent retrieved
terminal success. The fixture/synthetic data is removed; binaries retained.
The full driver race suite passes17.397s. Existing earned
dungeon/casino/combined receipts are not rerun or reclassified, and the default
mixed/nightly profile is unchanged. Dark King phases/rewards, actual non-Earth
rituals and declared capacity/headroom remain separate checks. The later Root
event receipt below retains its own earned, bounded scope.

### Dark King weekly-raid candidate

`-scenario party-raid -n 5 -raid-type weekly_raid -duration 20m` reuses the
normal five-to-ten-player raid conversion and every-member consent flow. All
prepared saves need level100 and the completed Umbral Nexus gate chapter.
The server chooses Mythic. Each client must observe its own live, matching
instance's ordered Orun/Earth, Neris/Water, Pyralis/Fire and Aeral/Air phases;
skipped, regressed, foreign, dead/town or unprepared phase evidence fails.
Announcements alone cannot prove a clear: every member must also observe the
actual cleared boss room and return alive to town. The explicit duration is a
maximum up to30m, not a soak or fight-duration acceptance criterion.

Preparation domain tests now include weekly raids at five and ten members.
Focused weekly/preparation race tests pass1.377s; the whole driver race package
passes17.714s. These use declared unit snapshots, not earned encounter evidence.
`TestLoadWeeklyActualFiveRolesPhasesExitAndSaves` is an opt-in actual-server
check using disposable level100 uncommon/rare fixtures, plate/shields for the
Fighter/Cleric, leather and dual daggers for the Rogue, and cloth/staff/tome for
the Wizard. Initial gear, level and chapter access are not an earned campaign.
Independent saves must preserve gear/bag/EP and show the original shared Dark
King victory, each personal weekly receipt/lockout, settled delivery outbox,
Gold/resonance and unclaimed finale readiness. The check has not yet earned a
runtime pass. Phase messages do not independently prove aid mechanics, human
balance, the requested five-to-ten-minute fight or representative capacity.

## Naturally scheduled four-class events

`-scenario party-event -n 4 -event-site root -duration 9m` requires supplied,
distinct prepared accounts in Fighter/Cleric/Rogue/Wizard order. Counts may be
4–100 in groups of four; duration must be explicit and at most45m. Selection can be
`current`, `root`, `tide`, `ember` or `gale`. Prepare level-appropriate legal
uncommon/rare gear and each site's recommended level35/55/72/72; the suitability
check is not a new game entry restriction. Existing gear and bag items are not
sold, equipped or picked up by this scenario.

The leader adopts only an announcement or first defending wave, never an
already completed or late-wave event. Every client must observe all four waves
while alive and physically near the site, then actual completion and a fresh
normal Recall return to town. Global views seen remotely or in private instances
do not prove participation. Expiry, changed occurrences, regressing counters,
invalid/stale views or missing recovery acknowledgements fail without retry.
The Wizard holds the live ward/rune/rim or moves with Gale; other roles fight
and heal through ordinary commands. No event clock, kill, charge, reward or
resource bar is assigned by the controller. Completion exits early; the duration
is a maximum, not a capacity-soak claim. `Event coverage` separates selected
groups, present/completed/exited players and the minimum own wave observations.

Focused race checks pass1.345s; the preceding full driver suite passes17.594s.
Those are controller/unit fixtures, including actual game empty schedules with
declared unit-test timestamps, **not earned connected event completion**.
`TestLoadEventActualFourClassRootClearExitAndSaves` is a separate opt-in normal
server/driver/disposable-Mongo test: set `EIDOLON_LOAD_EVENT_FULL=1` alongside the
isolated environment flags above, and start during the first40s of an actual
Root announcement. Outside that window it skips rather than advancing time.
It prepares level35 uncommon/rare class gear and full initial resources clamped
by login to the normal build maxima, requires full waves/champion/town
exit, then independently reads saved XP/Gold and preserved equipment/bag
sentinel/EP. Prepared positioning and equipment are fixtures, not an earned
journey. The first connected check **failed481.98s at normal expiry**: all four
observed four waves, but nobody completed/exited; no OOM or read/write errors.
Forty-one ordinary recoveries were acknowledged. A focused regression reproduces
the controller's all-member recovery pause/dead-leader target stall; the corrected
event-only controller lets live members keep fighting/healing and delegates
target selection to the first living nearby member. The Wizard earns a real own
combat impact before ward duty and defends if left alone with attackers. Own
wave/completion/town-exit gates are unchanged. Focused race checks pass1.378s and
the full driver race suite17.790s. A subsequent focused returning-leader
regression failed0.011s before aligning target delegation with the40-unit active
combat range; all event race checks then pass1.400s. The65-unit physical
participation range is unchanged. **The corrected actual run passed225.27s at
the real October4 20:00UTC Root window**, ending early after all-four normal
completion/town exits and independently saved progression/Gold with unchanged
class/equipment/EP and protected bag sentinel. All members observed all four
waves and had positive own combat impacts (minimum32). Eighteen normal
recoveries were acknowledged; no read/write/decode/admission errors or OOM.
Whole fixture peak576675840B is not game-heap/headroom evidence. The corrected
fixture/synthetic data is removed and exact binaries retained. One earned
four-player Root encounter, not other realms,100-player capacity, unique kill
attribution, full healer/telegraph balance, renderer/Internet or campaign pacing.
The failed fixture/synthetic data was removed and original binaries retained.
Post-failure saves showed XP1190 for each class, not successful town exits or
independently checked gear/reward preservation. Do not reclassify the earlier
single-Wizard Root evidence or repeat accepted raid/dungeon/casino checks.
Events remain separate from `combined` and default mixed/nightly workloads.

Predeclare the workload, duration, acceptable tick/network/database/client
metrics and headroom before a representative capacity run. Reuse compatible
existing checks and run only the remaining scoped workloads, not another full
campaign or arbitrary24-hour soak on every version.
