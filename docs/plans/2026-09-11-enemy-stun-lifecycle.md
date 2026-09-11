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
