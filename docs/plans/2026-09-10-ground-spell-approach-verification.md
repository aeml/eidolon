# Release 60 — settled ground-spell setup and retry isolation

Status: native and full client regression passed; new CI/live gates pending. No game,
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

September10,03:49: native7451 TERMINAL PASS1/37.6s (test35.5s), retries0, clean
d03ecde, Node24.18.0 inside sg render, normal `prepare:client` and isolated run
`ground-settled-0910` at18560/18561/41960. Started only after primary22725's
terminal evidence and cleanup. All three actual spells rejected wall placement
without cooldown and cast on reachable floor; trained radius/High-Low shape
checks, all five normal talent purchases and rank5 after fresh login passed.
Prepared QA levels/skills are geometry evidence, not earned progression proof.
Log `/tmp/eidolon-ground-settled-native.log`; archive
`/tmp/eidolon-ground-settled-proof-oQXGNa`, wrapper and supplemental scan0.
Exact owned API/Mongo/image and all three listeners were absent after normal
cleanup. This successful route emits no scene screenshot; do not claim visual
image review. Its actual shape/attachment/radius checks remain the evidence.

Full54348 TERMINAL PASS256suites/3618tests151.078s plus lint on unchangedd03ecde.
Logs `/tmp/eidolon-ground-settled-full-{client,lint}.log`. New CI/predeploy/
deployment/final-native/public-identity gates remain required after promotion;
local success alone is not release60 acceptance. This proof update changes
documentation only; runtime, version, patch notes and workflow remain unchanged.
