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
