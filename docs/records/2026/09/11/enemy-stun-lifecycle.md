# Enemy/NPC stun lifecycle — repaired locally, release acceptance open

The Fighter duration investigation exposed a separate existing gameplay defect.
A real paid Shield Slam applied damage and a stun deadline, but the next normal
enemy tick moved the target while stunned. After advancing the captured deadline
into the past, the normal tick still retained `Stunned`. Basic-attack admission
checks this flag, so expiry failure can keep attacks blocked indefinitely.

Reproduction58674 exited1: game0.099s, enemy moved from(60004,60000) to
(60002.01091770025,59999.79130978739) during the stun and kept the expired flag.
Log `/tmp/eidolon-enemy-stun-lifecycle-red.log`. The status-expiry block was inside
the player-only branch; enemy/NPC damage-over-time ticked separately.

## Repair boundaries

Enemy/NPC ticks now expire the stun flag against its deadline. Enemy AI pauses
while the stun remains active, preserving threat and pursuit for resumption.
Bleed/poison and death checks run first. The Seraph also pauses its AI while
stunned, but owner validity and summon lifetime checks still run and can remove
it normally. An initial local implementation returned too early for NPCs; review
caught that lifetime risk before acceptance, and the final guards explicitly
preserve those checks. No duration ranks, authored lengths, immunity rules,
cooldowns, targeting geometry or saved data change in this lifecycle fix.

## Verification and outstanding work

First lifecycle/duration/wall/replication focused race33681 passed game16.924s.
Expanded88626 then passed with the final NPC cleanup guards, covering paid
movement freeze and resume, enemy/NPC poison during stun, expiry, active/expired/
owner-dead/disconnected/moved Seraph cleanup, and paid Shield Slam immunity,
dead/other-instance/friendly exclusions. Existing Seraph/poison/dungeon movement/
enemy-impact tests are included. This is focused coverage, not full server or
native gameplay acceptance. Deadline-length tests use actual cast start/finish;
lifecycle tests advance the captured deadline to exercise the normal expiry tick.
Logs `/tmp/eidolon-enemy-stun-{lifecycle-green,expanded}.log`.

The separate Shield Slam talent-scaling patch is not required by this lifecycle
fix. Preserve independent commits so the general stun repair can be evaluated
without claiming the entire Fighter talent/copy audit is complete. Full server
race, actual browser dungeon/party combat and release/live acceptance remain
required. Pausing movement then allowing attacks to resume changes real combat;
do not infer balanced encounters from unit tests or old no-expiry runs.

Other root/slow/freeze/status consumers and the full160 talent gate remain open;
this patch must not be reported as a complete crowd-control audit.

## Replication and current-source follow-up

Added an explicit Enemy/NPC snapshot and protobuf encode/decode check for stun
start and clear. Both transitions must trigger delta change detection. A clear
must encode inactive with zero duration even when the captured deadline remains
on the authoritative entity.53435 passed server root0.009s at reduced build
parallelism; log `/tmp/eidolon-stun-wire-focused.log`. This verifies actual Go wire
encoding, not a live browser/remote observer or websocket session.

The general lifecycle fix (without the unfinished talent-scaling/copy change)
was cherry-picked onto accepted current-primary45efe670 as60c84422 in
`/tmp/eidolon-stun-lifecycle-current-20260911`. Full server race42912 is running
on that frozen source with GOMAXPROCS2, package parallelism1 and nice10 to limit
competition with current production QA. Do not claim its result before terminal
completion. Application client/scripts/CI are unchanged from45efe670; the prior
client/browser proofs retain that exact scope, not native stun gameplay proof.

## Current-source full regression — September11 04:07

First full42912 exited1 on60c84422: game445.696s failed only the real-world
regeneration fixture (hp49/mana51 instead51/51). The fixture removed hazards but
shared spawned overworld enemies; health loss is consistent with unrelated
combat, though the exact attacker was not captured.4df2efe5 puts that noncombat
fixture in a separate nonsafe scene, counts unexpected damage events, and closes
owned background callbacks. It keeps the real World.Update and exact fractional
rate assertions.51979 passed five consecutive race runs/game10.137s. No runtime
regeneration, town healing or Well Rested values changed.

The wire check and independently reproduced impact-time stun guard were then
integrated; current runtime source is7c6cf6b2. Full16462 exited0 on that frozen
source: server root27.354s/game444.808s, loadtest/database/lifecycle cached passes;
other packages had no tests. No race warning or worker panic was found. Command
nice10/GOMAXPROCS2/go test-race-p1./...; log
`/tmp/eidolon-stun-current-full-server-final.log`. The original failed full run is
retained, not relabeled successful. No client/scripts/workflow differences from
acceptedprimary45efe670; full server acceptance is now current, while previous
client/browser acceptance retains its unchanged-application scope.

The native four-role dungeon route was discovered successfully (one test), and
new ignored vendor dependencies prepared after confirming the vendor directory
did not exist. Ports18580/18581/41980 were clear. No local native/browser run
started while canonical production QA owns the GPU. Full four-role dungeon
completion, actual stun/party balance and release/live acceptance remain open.
The unfinished Shield Slam talent-scaling/copy patch is still excluded here.
