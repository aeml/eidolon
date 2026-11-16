# Release 1.0.23 — interrupted gallery jump repair

CI `34061096121` for `ad72a642592b5ce6fc6e22b23af1d8b2ab3a52dc` failed
**before deployment**. Client tests, server tests and browser smoke passed.
Predeploy animation QA failed twice at `animation-gallery.spec.js:707`, with an
Imp selected at Low quality: expected Run on the first attempt and Walk on retry,
but observed Idle. Both deploy jobs and the live gate were skipped. The last
fully verified release remains 1.0.22 `e0b9afd`.

## Cause and correction

The gallery's `playActorState('Jump')` starts a one-second jump timer. Both
`loadActors` and the next `playActorState` call presentation cleanup, but cleanup
did not cancel that timer. When the old jump elapsed, gallery `update` changed
the **currently selected** actor to Idle, even if it was a replacement actor
already playing Walk or Run. This is a deterministic preview-lifecycle defect,
not evidence that normal in-world Imp movement is broken.

Three focused regressions fail against the old implementation: interrupted jump
followed by replacement Walk, replacement Run, and cleanup of the original jump.
An uninterrupted jump still passes. Cleanup now clears the preview timer/elapsed
time, clears the actor's jump animation restoration state and restores its visual
height before the next presentation. All four regressions and 17 existing actor
animation tests pass (**21 tests, 2.370 seconds**).

The existing strict actor-state matrix is unchanged. A new real-browser check
switches Cleric Jump → Imp Walk/Run at High and Low, then observes beyond the old
one-second deadline. Full client validation passes **165 suites / 2,364 tests
in 86.343 seconds**, with lint passing. The rendered repeat passes **all 30
checks in 4.1 minutes**, including the original strict actor-state matrix and
new High/Low interrupted-jump check (6.4 seconds). Logs:
`/tmp/eidolon-release23-gallery-client.log` and
`/tmp/eidolon-release23-gallery-browser.log`; handles `14359` and `30310` closed. No
assertion now accepts Idle for a moving preview, and no gameplay balance changes.
This repairs verification of the pending 1.0.23 collection-inventory release;
its player patch notes and version remain unchanged.

## Evidence

- Failed CI log: `/tmp/eidolon-release23-predeploy-failure.log`.
- Downloaded anonymous evidence: `/tmp/eidolon-release23-animation-evidence-5RyhfA`.
  Both page snapshots identify Imp/Low and their selected movement state. The
  first failure screenshot was visually inspected.
- Meaningful red regressions: `/tmp/eidolon-release23-gallery-red.log`
  (3 failed, 1 preservation pass). Earlier new-test setup errors were corrected
  before this red result: use the project's ESM test command, import Jest, and
  start with a jump-capable Cleric rather than a Skeleton with jump not used.
- Green focused run: `/tmp/eidolon-release23-gallery-green.log`.

Do not publish 1.0.24 or later over this failed gate. Verify and commit the exact
1.0.23 successor, push it without force, and wait for its full CI plus matching
uncached frontend/login/backend identities before advancing the release queue.
