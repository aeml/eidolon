# Alpha1.0.51 save bridge — pending release

Built on the preserved sequential50 queue including the0.01 regeneration and
nightly isolation fixes. Integrates the verified room-XP transition fix and
the progression-version1 compatibility bridge, without activating curve2 or
the expanded story. All package, login, server, build/deploy and QA identities
are51; actual patch history preserves50 and all earlier versions.

The room payout now uses the existing full award path. Amounts remain unchanged;
the fix makes already-earned room XP trigger its levels immediately. Historical
pending values still receive the bridge's once-only old-curve processing on login.

The bridge's standalone full race regression and two100-session ordinary
login/save/rollback/activation checks are recorded in its evidence document.
The expanded session test covers equipped, bag, stash and buyback gear plus
Forge precision. Those component results do not establish this combined51
release: combined full suites and actual sessions using the packaged51 server
are required. Actual earned campaign pacing remains a separate open gate.

This is an unreleased candidate. Publish only after45–50 have each passed their
normal CI/deployment/live-identity gates. Preserve progression version1 until
this compatibility build is verified live; a later deliberate activation must
use version2 and its coordinated budgets, not just replace the XP formula.

## Combined verification

Sourcef929c33 passes focused presentation/regeneration/soak55325 (232 tests),
lint34233, full client39001 **219 suites /3226 tests /178.082s**, and full server
race55684 **game422.193s** with the other packages also passing. All handles
closed without changing the frozen source or restarting on observation waits.

Packaged51 real sessions9057 **PASS /37.92s /test process39.014s**:100 ordinary
login/join/disconnect snapshot cycles, four classes/five save cases, phases
1→2→1→2→2. The bridge binary was built from this packaged51 source; candidate
binary remains762a46b with curve2/31 chapters/new regeneration. Equipment,
bag/stash/buyback items, Forge basis, gold, base stats, spent points, Resonance,
zero-reward promises and unknown future discovery records retain their tested
values. The owned Mongo and fixture data were removed; evidence remains at
`/tmp/eidolon-compat-release51-J6wjGl/` and
`/tmp/eidolon-compat-release51-sessions.log`, which lists per-phase server logs.

These results do not make51 live or complete the roadmap. Publication remains
behind the45–50 gates, and earned full-campaign validation remains open.
