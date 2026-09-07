# Release 42 — exposed portal pointer verification

Alpha 1.0.42 `ea565ebfdedb52fff7841e0fd4d650febd3d20da` deploys in CI
`34166841477`, but its live character gate fails. Six tests pass; the focused
Verdant entrance and Verdant gameplay route time out on the entrance menu,
including both retries. Live four-class/remote-animation verification does not
run after that failure. Successful deployment is not full release approval.

The unmodified input strategy with observational probes (`ad21d93`) reproduces
the failure locally: actual hover, fresh click and pending interaction all select
a live Inferno Titan at (804.8,205.9). The ray also intersects the entrance, but
the correct production priority selects the enemy. Zero dungeon-status requests
or responses occur. This is not an unresponsive server or a rejected portal
interaction. Log `/tmp/eidolon-release42-portal-observation.log`; the failure
remains recorded, credential scanning sanitizes two files and cleanup passes.

QA-only correction `f94ea72` waits for the real camera and actor to settle,
samples exposed points on the actual entrance meshes, checks canvas ownership
and normal hover, and requires the fresh click to select the portal. No hover
assignment, direct menu opening, status request injection, enemy removal or
production targeting change is used. Read-only click/request probes remain for
future failures. Real-geometry desktop/touch tests retain enemy selection through
the overlapping entrance and allow exposed portal clicks while that enemy lives.
All 11 targeting tests pass in 0.591s; lint and whitespace checks pass.

Actual clean-source verification on `f94ea72`:

- Focused portal route **11052 PASS / one test / 11.9s** (test 10.6s): entry,
  re-entry and real jump-time town recall. Log
  `/tmp/eidolon-release42-portal-exposed.log`.
- Water/Verdant routes **72220 PASS / two tests / 4.7m**: Water eastward movement,
  reconnect, town recall and re-entry (15.9s); Verdant ordinary kills, Rootbound
  Warden, later spawns and Briar Matron (4.4m). The latter is the existing bounded
  first-boss/later-spawn route, not a full dungeon completion claim. Log
  `/tmp/eidolon-release42-portal-dungeons.log`.
- Both runs pass credential scanning with zero sanitizations and remove their
  disposable containers/data. This is level-prepared functional QA, not leveling.

The first full client run **77557 FAIL / 211 suites pass, one fails / 3,131 tests
pass, one fails / 82.161s** exposes the existing uncontrolled clock in
`GameEngineCombatFeedbackVisuals`: adjacent bleed assertions assume execution
within the real 80ms throttle. The test now fixes its clock, preserves independent
target/kind checks and explicitly checks before, at and after the 80ms damage /
140ms healing boundaries. The clock is restored even on failure. Production
throttling is unchanged. The 26 focused feedback tests pass in 0.677s and lint
passes. Final clean-source **24146cd** full client **27855 PASS / 212 suites /
3,134 tests / 72.867s**, log `/tmp/eidolon-release42-portal-final-client.log`.
All owned checks are terminal; no browser or isolated backend remains. Failed log:
`/tmp/eidolon-release42-portal-client.log`.

The correction contains only tests and this evidence record. Keep the existing
1.0.42 patch notes/version: no game feature or balance change is introduced.
After final local verification, publish an explicit corrected 42 release ref as
a normal descendant of ea565; preserve all old candidate refs. Do not publish
43 until corrected 42 passes every CI/deployment/live gate and fresh public
manifest/login/versioned-main/backend identities match. The 1.1–1.10 roadmap,
coordinated economy and touch/campaign gates remain open.
