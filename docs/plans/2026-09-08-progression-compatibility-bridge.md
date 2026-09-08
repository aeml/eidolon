# Progression compatibility bridge — unreleased

This bridge retains **progression version1** and all100 existing exponential
XP thresholds. It understands both the old and proposed version2 save formats.
It must be deployed and verified before activating the new curve; it is not
the balancing release and changes no fresh combat/quest reward budgets.

New characters, regular snapshots and administrative level saves write the
active progression version. Login validates the saved version/level/XP before
publishing an entity. Genuine pending old-curve levels are processed first;
remaining progress is converted by fraction, rounded down, on a cross-version
load. Same-version reload is exact identity, including large legacy XP values.
Cap-bar sentinels do not become Resonance; genuine pending overflow does.
Existing stats/allocations, gold, skill points and Resonance survive. A pending
level-up heals after equipment/stat restoration, following the candidate fix.

Rollback must preserve more than XP. The bridge also round-trips future
investigation masks and optional-chapter flags, keeps unknown future story
records during catalog/daily refresh, and honors accepted/completed quest XP,
gold and kill-count promises. BSON field presence distinguishes a promised zero
from a missing historical field. This does not activate the expanded story.

## Evidence

Initial focused three-race run **17577 FAIL /game67.056s** exposed overflow in
the copied *test oracle*: it multiplied two large legacy values even though
the runtime correctly returned unchanged XP. The version1 expectation is now
direct identity; no runtime arithmetic was relaxed. An initial formatting
command used paths relative to the wrong directory and made no edits; formatting
was then run from the correct directory before the successful rerun.

Expanded migration/quote/snapshot/level-command checks pass **57208 /three race
repeats /root9.106s /database1.096s /game77.036s**. Coverage includes all99
uncapped levels, old/new formats, repeated rollback reload, cap overflow,
all-class stat preservation, actual snapshot BSON, explicit-zero contracts,
and future diary/hunt records surviving three save/refresh round trips.
The public login migration function is tested, not only its private converter.

Runtime scope is server-only; fresh XP thresholds/rewards and client behavior
remain the current release's. Full server regression and actual isolated
database/login/rollback sessions are still required. The new31-chapter curve2
candidate must deliberately activate version2 when eventually integrated;
the bridge's version1 assertion must not accidentally keep the old curve then.
Neither this bridge nor the balancing candidate is release-packaged or live.

Full server **31499 FAILED /game336.059s**, one test: the older partial daily-
catalog fixture expected an accepted10-kill/1XP contract to be overwritten with
100kills/50,000XP. The assertion now checks metadata/missing-gold repair while
retaining the accepted terms, matching the already-tested candidate policy.
The existing new-character daily test still checks fresh catalog requirements.
No runtime behavior or promised-reward protection is relaxed. A fresh full
server regression is required after this test-only correction.

Corrected daily checks **80043 PASS /three race repeats /2.578s** and full
server **18636 PASS /game335.929s**, other packages cached from the previous
run (root17.340s/database1.042s). Handle closed. That full check ran on96143fc
plus the known test/doc correction because a pre-run git command used the wrong
relative path and did not stage/commit. The unchanged diff hash was verified
before closure (`35a772f19f58913fa0552f7a5f8026cf6d99a82cce32906110285a3fdb9e37ad`).
No duplicate check was started on an observation timeout. Actual isolated
database/login/rollback sessions remain the next verification gate.

An opt-in actual-session harness is now drafted in
`server/progression_session_integration_test.go`. It is designed to launch
explicit bridge/candidate binaries on owned loopback ports against an explicitly
disposable Mongo, log in and join through WebSocket, wait for real disconnect
snapshots, then cycle1→2→1→2→2 across four classes and five save cases. It also
checks zero-reward promises and unknown future discovery records. Compile-only
run83002 passes with the integration intentionally skipped; **no actual session
success is claimed**. Work paused for the user's new regeneration-rate fix.
