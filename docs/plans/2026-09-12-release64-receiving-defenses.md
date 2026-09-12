# Alpha 1.0.64 — receiving defenses

Status: scoped candidate, not deployed or fully accepted. Release63 remains the
last accepted public release. Full 1.1–1.10 scope remains in the main roadmap.

## Scope and provenance

Built from accepted release63 `f866df68`, separately from the much larger
development branch. Imports receiving-defense commits `adb89195`, `6e581eed`,
`20b9e673`, `9e1ed374`, `21d36078`, `9eda12af`, `9446887c`, `32f555e8` and
`98b6cb8e`. Together these cover immediate, projectile, persistent, autonomous,
wound and ordinary impact paths, shield expiration/retaliation, and raw versus
inherited wound outgoing/PvP budgets. Raw offline wounds receive the equivalent
critical/equipment composition fix.

The integration preserves release63 Fighter stun durations and campaign/economy
behavior. Dark King phase-cap calls from the original branch are deliberately
not imported: that separate mechanic and its two new dependent raid test files
remain on the development branch. Existing release63 raid tests remain intact;
this is not deletion of a published test or weakening a release64 requirement.
The previously opt-in ability-shield reproduction is imported as normal,
unconditional `TestPaidHostileAbilitiesRespectArcaneShield` coverage.

Imported investigation documents retain their historical evidence with explicit
provenance warnings. They do not prove this different integration or publication.
The pending Chronicle expansion, reward curve, Focus/Teleport/Mastery, and other
later development fixes remain required work; they are not silently bundled here.

## Player-facing delivery

Login, package/lockfile, release manifest, server/container/deploy defaults and
isolated-QA identity advance together to Alpha1.0.64. The in-game patch-history
entry explains defenses, shield expiration, hostile/wall-respecting explosions
and wound budgets, retaining all older entries and unchanged recovery/quests.
Version-presentation regressions enforce this candidate's identity and history.

## Current evidence

- Focused server race test PASS4.160s, including paid hostile abilities, receiving
  defenses, wounds, shield expiry and explosions. Log
  `/tmp/eidolon-release64-defense-focused-20260912.log`.
- Three client suites/253tests PASS1.961s: raw outgoing wounds, existing offline
  status consumers and version/history presentation. Log
  `/tmp/eidolon-release64-client-focused-20260912.log`.
- Changed-JavaScript lint PASS; log
  `/tmp/eidolon-release64-focused-lint-20260912.log`.
- Expanded three-repeat server race run PASS27.257s. Covers all paid-ability
  tests selected by `TestPaid`, immediate reactions, context identity, parallel
  wounds/projectiles, queued shield hostility, reflected Whirlwind/Charge/Seraph
  death, spread budgets and Dark King slam aid ordering. Log
  `/tmp/eidolon-release64-defense-repeated-20260912.log`.

## Required before acceptance

1. Review the scoped integration and finish expanded focused race coverage.
2. Run full client/lint/server race regression on the frozen release64 candidate.
3. Publish through the unchanged CI workflow: hosted tests/browser shards,
   complete native predeploy character route (including shield training, real
   absorption, saved ranks and expiration), deployment-input gates, frontend and
   backend deployment, and complete final live checks must all succeed.
4. Independently verify uncached frontend/backend identity, login version,
   retained patch history and database readiness; retain and inspect artifacts.

No competing local full or native suite is started while the actual four-role
dungeon run on frozen development208b0aa3 is active on the shared machine. That
run is encounter/progression evidence for its own source, not a release64 pass.
The user-cancelled soak remains off. Do not cancel normal CI on an observation
timeout, and do not mark1.1 or the full roadmap complete from this release.
