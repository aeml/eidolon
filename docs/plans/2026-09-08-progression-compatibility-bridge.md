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
success is claimed** at that draft checkpoint. Work paused for the user's new
regeneration-rate fix before the actual runs below.

## Actual login, save, rollback and reactivation closure

Initial real session35318 **PASS /57.00s /test process58.150s** with source38d4a9a
and candidate762a46b (the31-chapter curve2 candidate now includes the requested
0.01 passive regeneration). Twenty characters cover four classes and five
saved-progress cases: pre-versioned fractional progress, version1 pending levels,
version2 progress, an old capped-bar sentinel, and99→100 genuine overflow.
Five freshly started server phases1→2→1→2→2 use ordinary WebSocket login/join,
disconnect and actual Mongo snapshot writes, not in-memory resume/conversion.
All100 cycles preserve the expected level/fraction, base stats, zero unspent
skill points, gold, Resonance, accepted zero-reward promises, and unknown future
diary/hunt records. Discovery masks and optional flags survive every cycle.

Expanded source41d09ad adds equipped, bag, stash and buyback gear including its
earned stats/value/potency and retained Forge basis. Real session23737 **PASS /
38.60s /test process39.634s**, another100 cycles with exact nonempty item and
equipped-map comparisons. Runtime binaries were reused unchanged from the first
run; the new source is test-only. Test processes used the race detector; these
standalone server binaries were ordinary builds, with the separate full server
race evidence documented above. No all-class earned gameplay is inferred.

The two owned disposable Mongo containers and their fixture data were removed
after successful completion. No production data or unrelated services were
changed. Credentials use independent random account identities and are not
logged. Binaries remain in `/tmp/eidolon-compat-live-E2VoZe/`; logs are
`/tmp/eidolon-compat-actual-sessions.log` and `/tmp/eidolon-compat-assets-sessions.log`.
Each log lists the retained per-phase server evidence directory.

This closes the tested actual-session gate, not deployment or full campaign
pacing. When packaging the bridge, inherit the then-current release's0.01
regeneration and other fixes; its older base is not a whole-tree replacement.
Version1 must still ship before activating version2, and both need normal
sequential CI/live gates and explicit versioned patch notes.
