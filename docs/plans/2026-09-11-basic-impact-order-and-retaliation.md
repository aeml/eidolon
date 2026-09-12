# Basic impact ordering and damage-taken retaliation

> Historical development evidence, imported with the receiving-defense changes.
> This document's source hashes and phase-cap results describe that development
> branch, not the narrower release64 build. See
> [release64 scope and gates](2026-09-12-release64-receiving-defenses.md) for the
> current candidate: existing release63 campaign/economy and Dark King behavior
> are retained; the separate phase-cap change remains pending.

Local follow-up to the combined receiving-defense fixes, for the still-open1.1
combat gate. Not part of live domain1.0.61. Full1.1–1.10 scope is unchanged.

## Reproduction and implementation

45192 failed race0.252s using ordinary paid shields and actual scheduled basic
attacks in requested/accepted duels. Unshielded controls correctly dealt26,
52 guaranteed-critical, and175 burst-capped damage. Shielded attacks instead
consumed40,40 and9990 raw damage before critical/PvP processing; the last broke
a600 shield and still damaged HP. A paid Shield Slam also ignored equipped
unique/set reflection while its fully absorbed negative control passed.

Basic attacks now calculate outgoing modifiers, critical/PvP scaling and burst
caps once before receiving reductions/shields. No outgoing calculation runs
again after absorption. Existing QA near-death handling, impact geometry,
on-hit effects and ordinary event/death/credit handling remain.

Damage-taken reflection is shared by abilities/projectiles/periodic/wounds and
the legacy basic/slam adapter. Active, unexpired Iron Fortress Thorns reflects
20% HP damage; unique Thorns and the existing Bulwark reflection contribute
their separately rounded10%/5%. These do not reflect invulnerable/absorbed
damage. Arcane Shield Reflective separately returns30% of actual absorption.
Retaliation still uses the caller's actor-unlocked/live-actor context. The
advertised Iron Fortress timer is checked at impact, not only a later tick.

Boss slams also run outgoing calculation before receiving defenses. Actual
Dark King delayed AI slams are tested in prepared phases1/2/3: outgoing200 is
reduced to160 by Orun,180 by Neris, or remains200 respectively, before consuming
a real paid150 shield. This verifies that phase aid is not skipped by slams;
it is not a native raid-clear or encounter-balance claim.

## Verification

55560 focused racePASS8.244s after implementation.72245 passed three broader
race repeats29.380s, including paid ordinary/critical/burst cases, equipment
reflection, actual Iron Fortress→hostile Flame Whip (active/expired/invulnerable),
existing basic/shield/status/boss-retaliation/party and cadence checks.
13777 final focused racePASS7.267s adds the real Dark King slam phase cases.

Logs `/tmp/eidolon-basic-defense-{red,green,broad,final}.log`.
Full current-source regression, native four-role/feedback and saved-build
acceptance remain required. Preceding77916/d10f72bb cannot prove this patch.
Explosive-shield PvP hostility and raw/inherited wound outgoing budgets remain
open, along with the broader combat/talent/rune/phone/campaign roadmap gates.

Unreleased patch-note draft: Basic attacks consume shield capacity using their
actual critical/PvP damage budget. Ability hits now respect damage-taken Thorns
and set reflection; protected/absorbed hits do not trigger those effects.
The Dark King's slams honor the Eidolons' phase-specific protection.

## Full server acceptance on695578b0

56153 completed with exit0 on the unchanged basic-defense source. Full Go race
suite passed: root25.683s, game391.517s, loadtest1.026s, database1.128s and
lifecycle1.029s; remaining packages have no tests. Log
`/tmp/eidolon-basic-defense-full-server.log`. This accepts the server regression
for the basic-order stage, not later explosive changes or native combat balance.
The subsequent explosive repair replaces the last basic/slam adapter with the
same queued receiving context already used by abilities.
