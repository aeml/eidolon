# Release 60 — settled ground-spell setup and retry isolation

Status: candidate QA correction, native/full regression not yet run. No game,
spell, movement, geometry, reward, version or patch-note changes.

## Actual failure

CI34430017443 oncaab611 is terminal failed at predeploy102727073506. All server,
client and browser jobs passed, as did the High/Low gallery. Disposable gameplay
passed its initial seven cases and trained Flame Whip, then ground-area failed
before any wall-rejection or reachable-floor spell assertions. Deployment,
production-input validation and final live jobs were skipped. Public client and
healthy/database-ready backend still report60/df91bb6 at03:16UTC.

Log `/tmp/eidolon-release60-yield-predeploy.log`; artifact10134910275 retained at
`/tmp/eidolon-release60-yield-predeploy-proof-KIFTbd`, supplemental scan0. The
artifact contains failure contexts but no at-failure scene image/trace for this
test; do not claim one was inspected.

First attempt started03:09:31.503; retry began03:09:56.266. It failed with2.12694
units remaining against a strict less-than-two-unit waypoint assertion. Thus
its45-second approach deadline could not have expired. The loop had observed
less than two units, broken out, then read a different position before waiting
for IDLE. `moveByGroundClick` promises minimum displacement, not settled arrival.
This establishes inconsistent moving observations, not a proved dungeon wall or
spell-collision regression.

Retry failed expecting Mana Geometry rank1 but seeing5. The original attempt
had trained five ranks, and retry reused its persisted QA character. Neither
attempt established the requested ground-spell behavior.

## Correction

- Observe IDLE, no pending destination and settled camera tracking before each
  waypoint decision or next ordinary ground click. Keep one absolute45-second
  budget, the strict two-unit tolerance and bounded12-unit walking steps. No
  forced positions, jumps, raycasts, broad timeout increase or hidden failures.
- At approach failure capture exact room, destination, actor/movement/camera
  state and a scene image before the dungeon helper returns to town; rethrow.
- Use a fresh `-retry1` QA username on the existing single retry. Add only the
  exact disposable `-ground-retry1` allowlist entry; the base retry was already
  authorized. Assert rank0 before training, retain all five actual purchases,
  accepted-shape/radius/quality assertions and the final rank5 fresh-login check.
- Keep Meteor Drop, Inferno Cataclysm and Gravity Well wall rejection without
  cooldown and reachable-floor casting assertions unchanged.

## Evidence and next step

Focused45367 passed6 new approach/wiring cases in1.252s, lint and shell syntax.
Expanded1600 passed110tests/7suites2.315s covering movement input, trained shapes,
helper behavior, isolated QA defaults/preflight and live-gate wiring. Node24.18.0.
Logs `/tmp/eidolon-ground-approach-{focused,lint,regression}.log`.

Actual ground-shape replay and full client regression are pending. Primary
fresh-story22725 still owns the local browser; do not cancel it or overlap owned
browsers/heavy tests. After its terminal evidence/cleanup, run the existing
`EIDOLON_ISOLATED_QA_ROUTE=ground-shape` with a unique run ID, isolated ports,
Node24 inside sg render, prepared vendor assets and retries0 first. This uses
prepared QA level/skills for geometry verification, not earned progression.
Inspect genuine state/geometry results and failure images if any, then perform
full client regression before promoting into canonical60. All new CI/predeploy/
deployment/final-native/public-identity gates remain required; no new push yet.
