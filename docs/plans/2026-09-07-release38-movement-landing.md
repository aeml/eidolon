# Alpha 1.0.38 — accepted Teleport landing correction

CI `34134256905` on `c788e85` fails before either deployment. The movement-wall
check's first cast misses its assumed north-wall endpoint by 0.285 units; retry
receives the wall endpoint but the local character settles 2.83 units away.
The log is `/tmp/eidolon-release38-phone-chat-ci-failure.log`. Other predeploy
results include a retried manual-loot pointer failure. No 1.0.38 live success
is claimed; fresh public manifest, login, versioned entry and healthy/ready
backend at **15:17:11 UTC** still agree on 1.0.37 / `2e37508`.

Read-only source review finds the owning player's Teleport ability event only
reconciles visual shape. Position depends on normal state correction, which
deliberately permits a three-unit prediction deadband. New local event tests
reproduce three ignored accepted landings (0.5, 2.83 and 12 units), with four
non-landing/malformed cases already passing (**0.870s**). This reproduces an
independent defect; CI did not capture enough position/input history to prove
it was the only cause of both original failures.

Correction `fec87c6` commits finite accepted local Teleport coordinates directly,
clears stale path/intent/velocity, updates chunk ownership and camera, and retains
the usual correction presentation. Charge is not snapped to its destination,
and remote/non-movement/malformed events retain their existing behavior. Server
source is unchanged. Focused movement/respawn/shape/event checks pass
**109 / 1.833s**. Full client checks pass **197 suites / 2,905 tests / 96.375s**;
lint and whitespace pass. Logs: `/tmp/eidolon-release38-blink-before.log`,
`/tmp/eidolon-release38-blink-after.log`,
`/tmp/eidolon-release38-blink-full-client.log`.

The wall driver now projects an unshortened Y=0 point beyond the actual wall,
checks the production cursor ray, and additionally casts a real 1.5-unit blink.
It verifies the short landing again after the movement lock and idle heartbeat.
The navigation helper had silently shortened covered/off-screen vectors and
projected actor Y=0.5, so it was not a valid exact cast-aim guarantee.
The first exact-aim run fails its overly precise setup assertion before casting;
no cursor diagnostics were yet retained for that failure. An observer-only
follow-up `10a4060` passes **24.6s**, including wall event/landing, the short
blink staying at its accepted coordinates, wall/open-floor jumps and return.
Credential scan passes with zero sanitizations and disposable cleanup completes.
The setup failure remains evidence to investigate, not a claimed resolved flake.
Logs: `/tmp/eidolon-release38-blink-browser.log`,
`/tmp/eidolon-release38-blink-aim-observer.log`.

An earlier sequence on observer `eb9b613` fails manual-loot pointer acquisition
on both attempts before movement runs (54.5s); the direct old-runtime movement
probe on `6bceafb` passes 17.0s. The current helper preserves acquisition and
receipt requirements, adding bounded credential-free hit-stack diagnostics.
The authenticated → beam/ground/movement sequence on `10a4060` passes:
**three authenticated checks / 48.2s**, then **three dungeon checks / 1.5m**.
Short blink is still at its accepted position after the movement lock/heartbeat.
Credential scan and disposable cleanup pass. Log:
`/tmp/eidolon-release38-blink-sequence.log`.

The exact-aim component fixture then reproduces the setup problem with the real
InputManager and browser mouse: a fractional-pixel destination truncates to a
different CSS pixel, producing **0.165 units** of error (**failure / 15.2s**).
The helper now selects the nearest integer pixel and compares the actual input
ray against that pixel's ground point, without shortening the intended vector
or relaxing the gameplay landing assertions. It passes **3.5s**. Initial fixture
setup used the wrong Three module path and was corrected before this regression
was measured. Logs: `/tmp/eidolon-release38-ground-aim-red.log`,
`/tmp/eidolon-release38-ground-aim-after.log`.

Three repeated real loot routes on `3be02d2` (only this untracked documentation
made the checkout dirty) produce **two passes / one failure / 1.4m**. The failed
hit stack contains a living attacking Skeleton ahead of the intended active
LootDrop and another drop. The item is present and on canvas, not already picked
up. This is correct enemy priority at a covered point; the helper repeatedly
aims at the same center instead of an exposed side. Retained evidence:
`/tmp/eidolon-release38-loot-acquisition-repeat.log`.

A new component fixture with the actual LootDrop hitbox, InputManager and
GameEngine raycast reproduces the center-only helper failure (**2.9s**), while
independently proving the hostile retains priority there. The helper now tries
interior points on exposed hitbox sides through real mouse movement and the
normal hover budget. It still requires the exact intended loot ID and later
an item-specific inventory receipt; no direct pickup, changed collision, or
priority override is used. Combined aim/loot fixtures pass **2 / 6.1s**.
Logs: `/tmp/eidolon-release38-loot-pointer-before.log`,
`/tmp/eidolon-release38-pointer-after.log`. Both fixtures join anonymous CI.

Patch notes now include **Short blinks count** without advancing or replacing
1.0.38. The later version/default/local-landing checks pass **220 / 2.921s** and
lint passes before the additional anonymous-CI guard. Final guard/lint, repeated
actual loot, corrected movement sequence and full anonymous package checks
remain open. Do not republish or carry an unverified fix through 39–43 yet.
