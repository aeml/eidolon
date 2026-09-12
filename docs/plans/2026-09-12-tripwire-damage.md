# Tripwire — paid damage and critical talents

Unreleased 1.1.0 candidate, based on integrated Fortress and Blade Storm8561a773.
The actual server trap omitted its skill identity and damage multiplier, making
ROG_23 Mastery and ROG_24 Technique ineffective. Offline Tripwire only rooted.
This is a real consumer repair, not a new talent or a change to purchased ranks.

The trap now snapshots base20+Dexterity with the applicable damage multiplier
and retains its Tripwire identity for the existing critical calculation. Offline
hits use the same named damage/critical path and normal recipient damage method.
Both paths reject hits across dungeon walls. Offline triggering additionally
rejects friendly, dead, inactive, remote/online and cross-instance recipients,
uses horizontal proximity like the server, expires after60seconds and respects
CC immunity. Cost25mana, cooldown15seconds, base root3seconds, foot placement
and existing trap radius remain unchanged. No trigger-area/rune redesign here.

Actual paid-cast regressions first failed9client cases and server talent/identity
checks. Tests now cover legal server purchases and actual trap creation/update
at Mastery0/1/5 × Technique0/1/5, controlled critical boundary, mana, root and
single consumption; disconnected floor rectangles cannot trigger/consume traps.
Offline tests additionally cover CC immunity and exclusion cases. The shared
Rogue damage contract now includes Tripwire as its seventh damaging profile.
The older effect-routing fake was replaced with a real Imp while retaining its
effect parent/disposal assertions.

Focused server race checks PASS25.587seconds, including shared Rogue contracts,
duration, actual critical projectiles and Blade Storm. Final client6suites84tests
PASS5.502seconds. Full lint, prepared assets and diff checks passed. Logs:
`/tmp/eidolon-tripwire-damage-*-20260912.log`. Full CI and a real in-game paid,
trained/saved trap/damage/root route remain required before integration. These
results do not close all160talents, dungeon balance or the 1.1 release gate.

Full CI34711930441 on d4a0017f exposed six failures in the independently shared
offline paid-Mastery suite (409other suites/6389tests passed). It assumed every
non-instant profile emitted a traveling projectile and supplied no effect scene,
so adding Tripwire correctly exposed a missing trap-fixture path. The shared
profile now identifies Tripwire as a trap; that suite uses a real effect scene,
checks its actual stored cast damage after equipment/ranks change, triggers it
through Rogue.update, and asserts root and single consumption. Existing moving
projectile assertions remain unchanged. Corrected focused3suites82tests PASS
3.555s/lint/diff; shared server/paid trap race PASS15.013s. Logs
`/tmp/eidolon-tripwire-{offline-contract-corrected,kind-server}-20260912.log`.
Full corrected local client95636 PASSED410suites6395tests360.246seconds.
Exact efda8f9f CI34712331175 client also PASSED410/6395/135.117seconds and
server passed; three browser shards remain active at this entry. Original
CI34711930441 is terminalFAILED with the retained six fixture failures; no
running job was canceled or replaced. Native trap acceptance remains required.

CI34712331175 subsequently completed SUCCESS on efda8f9f, including all three
browser shards. No native/deployment pass is inferred from those manually
skipped jobs. A new real-input Tripwire route is authored: normal town recovery,
level-only/waypoint preparation, ordinary enemy chase across a placed trap,
paid0/1/5 Mastery and Technique purchases, High/Low and saved ranks, actual trap
replica/amount/removal and target root/expiry. No target-position, hit, rank or
timer injection. Critical outcomes remain random (observed damage must equal
stored base or its double); exact Technique probability boundaries retain their
deterministic receiving tests. Healthy ordinary Skeletons are required so death
cannot replace root-expiry evidence. This is prepared ability QA, not earned
first-hour or dungeon balance.

Route is allowlisted and included once in full QA with zero retries. Updated
both independent stage/command lists. Four suites103tests PASS3.938s plus full
lint/diff/assets, including real-message observer ownership and gate failure/
cleanup contracts. Logs `/tmp/eidolon-tripwire-native-*-20260912.log`.
Native execution is queued behind the active four-player run. App/runtime source
is unchanged from accepted efda8f9f; retain a combined full regression after
integration instead of attributing the earlier CI to these newly authored tests.

## Native setup correction

Native63454 on65642f33 terminated FAILED39.3seconds before casting: the
healthy-Skeleton selector returned null. Archive
`/tmp/eidolon-tripwire-selection-failure-DEv64o`; credential scan sanitized0,
owned containers/image and18185/18186/41875 confirmed clear. Source inspection
also proves the setup could not guarantee root expiry: even level10Skeleton
has150HP, below the prepared level100 trap's possible critical damage.
Use the existing Verdant waypoint and real InfernoTitan instead, requiring
observed health greater than twice the actual current-rank trap damage and no
CC immunity. Keep the independent before-cast health assertion. No enemy stats,
damage, root timing or player position beyond existing bounded preparation
are altered. Focused2suites9tests PASS1.086seconds; native replay still required.

Corrected native39281 onb167ad91 FAILED33.2seconds during ordinary approach:
the durable target was selected, then became missing/inactive/dead before the
next approach step. Existing evidence does not distinguish those causes. Archive
`/tmp/eidolon-tripwire-approach-failure-80mGUX`, scan0 and exact cleanup verified.
Added bounded read-only player/target/position/health/state/instance snapshots
for each approach step and a failure screenshot, retaining original input and
failure assertions. Do not replace the target or claim a trigger/damage/root pass.

Diagnostic50573 oncf57bde7 FAILED42.7seconds, archived
`/tmp/eidolon-tripwire-approach-diagnostic-7jmE07`; scan0/exact cleanup verified.
The attached observations establish a test-input error: planned seven-unit
approaches instead moved from800/200 to731.87/131.87, then688.73/88.73 and
eventually614.06/14.06 while the same Titan retained1760HP. The screenshot
shows an accidentally opened dungeon guide. Production mobile clicks select/
clear targets or interact, rather than desktop move-only walking. The shared
helper's mobile W-key fallback accounts for this fixed northwest movement.

Replaced Tripwire approach/lure with actual CDP touch on the visible joystick,
using the inverse of production isometric direction, measuring forward progress
and releasing touch in finally. No keyboard fallback or synthetic actor movement.
Living/same-instance and stick-release checks remain explicit. Unit direction
cases use actual InputManager.getMovementDirection; an initial incorrect method
name failed six cases and was corrected, not treated as a game defect. Native
paid trap/damage/root acceptance is still required.

Joystick candidate b2d9a268 focused3suites19tests PASS1.808seconds, ESLint/diff
passed. Native84373 FAILED25.8seconds during approach (before casting), archive
`/tmp/eidolon-tripwire-joystick-failure-x20Rqt`, scan0/exact cleanup verified.
First movement overshot the planned seven-unit step:800/200→825.07/172.50;
next step timed out at3.568units projected progress, below5.25required. Target
remained alive1760HP in the pre-step snapshot. Failure image shows the player
near dungeon-building geometry and Titans. Actual endpoint/blocked-state of the
last step was not captured, so collision/body obstruction is a hypothesis, not
a proved cause. Need bounded joystick approach and endpoint evidence; don't
lower trap/root assertions, inject positions, or claim native combat acceptance.
The shared click helper's mobile keyboard fallback remains outside this focused
route change; audit its other callers separately instead of assuming repaired.

The next helper uses at most eight80ms real-touch pulses. Release is sent on
the Node driver clock before awaiting touch-start acknowledgement, then both
protocol receipts and actual endpoint are checked before another pulse. This
avoids holding movement through slow browser observations. Each endpoint records
HP/state/instance, projected progress, released stick and blocked-target position;
exhaustion throws those bounded samples. Approach asks for three-unit steps;
trap luring retains its eight-unit requested direction. Unit tests cover delayed
start acknowledgement, observation failure cleanup, eight-pulse bound and actual
production inverse direction. No world/clock/joystick-state mutation. Native
replay remains queued behind the active four-player Low comparison.

### Pulse replay exposed duplicate protocol release

Native44547 on9cb94108 failed12.4s during approach: the helper's unconditional
finally block sent a second touchEnd after a successful release. Chrome rejects
that sequence. No actual trap acceptance was reached. Archive
`/tmp/eidolon-tripwire-touch-release-failure-uoD4FU`; credential scan0 and exact
disposable cleanup passed. The error does not prove the pulse movement endpoint.

A stateful protocol test reproduced three failures with one cleanup control
passing. The helper now tracks outstanding release only, retaining cleanup for
a failed release without issuing another after success. Both direction/movement
suites pass14tests1.776s, including delayed acknowledgement, protocol state,
failed-release cleanup, observation failure and bounded stalled movement. ESLint
and diff checks pass. A fresh actual replay is still required; no gameplay or
acceptance assertions changed.

### Actual collision-ejection cause and waypoint correction

Native68266 on02cb0df2 failed12.0s before any cast. The first80ms touch moved
from800/200 to764.68/207.73 (36.15units), then the return direction stalled near
the building edge. Archive `/tmp/eidolon-tripwire-pulse-overshoot-17f0nU`; scan0
and exact cleanup passed. Screenshot and attachment were inspected.

The production entrance definition is centred at800/200, exactly the old QA
waypoint, and WorldGenerator installs its32.79unit circular collider. A test
using the real CollisionManager reproduces >30unit ejection from a quarter-unit
step. Therefore the apparent first-pulse overshoot is explained by collision
resolution, not proven to be a long joystick hold. Earlier latency hypotheses
must not be treated as the established cause.

The allowlisted fixed Verdant QA waypoint now arrives at800/250 on the forecourt.
Both tested player radii and eight initial walking directions clear the actual
entrance collider; the old-centre regression remains as a control. Server command
tests retain authorization, instance restrictions, stationary target and protection
checks; only expected arrival coordinates change. Existing waypoint consumers
check the new position. Ordinary entrances, enemy/player stats and public travel
are unchanged. Native Tripwire also filters candidate approaches through the
existing complete walking-path check instead of aiming through the entrance.

Waypoint RED2fail/1controlpass, then5suites28tests PASS3.648s and paid command
race PASS2.962s. The optional target-path predicate failed before implementation;
combined6suites34tests pass, plus ESLint/diff. Logs use
`/tmp/eidolon-verdant-waypoint-*-20260912.log` and
`/tmp/eidolon-tripwire-clear-approach-*-20260912.log`. Full CI and new native
execution remain required, including rechecking affected entrance/shield routes.

### Forecourt replay reached a real cast; snapshot assertion was invalid

Native64049 on9048c71a failed9.3s AFTER normal approach and paid Tripwire
placement: the test expected139 in the trap snapshot's damage field but received0.
Production `copyEntity` intentionally includes projectile owner/velocity/radius,
not internal damage; protobuf defaults that omitted field to0. Actual triggering
uses the live server entity, not this optimized snapshot. Do not claim a zero-
damage gameplay bug from that wire value. Archive
`/tmp/eidolon-tripwire-wire-contract-failure-giMuZZ`, scan0/exact cleanup passed.

The observer now records only delivered trap identity/position. Native still
requires the real accepted25mana cast, placement, visible mesh, actual target
damage equal to trained base or random critical double, root/expiry, single
trigger and saved ranks. Server paid-trigger tests retain internal damage checks.
Wire-shaped regression first failed2cases, then3suites13tests PASS0.863s plus
ESLint/diff. New actual trigger/expiry replay remains required.

## Draft 1.1.0 patch note

- Fixed Tripwire's damage and critical talents not affecting triggered traps.
  Offline traps now deal their intended damage, respect friendly targets and
  crowd-control immunity, and expire correctly. Traps cannot trigger through
  dungeon walls.
