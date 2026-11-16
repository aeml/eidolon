# Alpha 1.0.30 — a steadier hunt

Candidate only; ordered publication remains in the roadmap execution ledger.

The earned Wizard readiness run on the 1.0.29 runtime reached level 34 without
deaths, manually saved its rewards and enabled Verdant entry, but **failed** its
final browser-error assertion. Repeated exceptions came from `Imp.update`, not
world generation: `Actor.move` can clear an arrived destination, which the Imp
immediately passed to `Vector3.distanceTo`. The original failed log remains at
`/tmp/eidolon-fresh-ready-wizard-defense-recovery.log`.

Eight new regressions use the real Actor movement path. Before the fix, both
zero-distance/short-distance roaming cases reproduce the null-coordinate error,
and three replicated-Imp cases demonstrate a second local attack, chase or roam
after the base server-owned update. Ordinary local roaming, pursuit and death
checks already pass. Initial log: `/tmp/eidolon-1-0-30-imp-before.log`.

The repair treats a cleared destination as arrival and prevents replicated Imps
from running a second local AI decision after their base update. It does not
change server enemy strength, rewards, progression, saved state, other enemy
types or local Imp roam timing. Separate patch notes and login/package/server/
deployment version defaults identify 1.0.30 while retaining all older history.

All eight post-fix regressions pass. Full client verification passes **173 suites /
2,461 tests in 65.521 seconds**, lint passes and server race checks pass (root
9.330 seconds; unchanged game package cached). Logs use
`/tmp/eidolon-1-0-30-{imp-after,client,lint,server}.log`.

The new earned-route measurement **failed its final browser-error assertion in
15.3 minutes**; session `22831` is closed, log
`/tmp/eidolon-1-0-30-fresh-ready.log`. Opening, collection, both 100-enemy contracts,
manual rewards, fresh-login persistence and enabled Verdant entry all passed;
the character reached level 34 with zero deaths. The Imp hunt took 595 seconds
(606 including reward/login), using 231 ordinary retreats and no Shield casts.
No Imp null-destination exception was recorded. Instead, Chrome reported
`ERR_NETWORK_CHANGED` while loading local modules. This is not a clean full-route
pass. Credential scanning and exact disposable cleanup passed.

During this local run, 1.0.25 CI attempt 1 stopped before gameplay because its API
port 18085 was already occupied by the local test. No deployment ran. After local
cleanup, the unchanged failed jobs were rerun. Local isolated QA now defaults to
18185; CI explicitly reserves 18085, with adjacent authenticated Mongo ports.
Linux defaults to the already-supported host-network mode and loopback-only
services, avoiding bridge/veth changes made by this script. Other platforms keep
bridge mode. A configuration regression checks disjoint port pairs and loopback
bindings. This removes the confirmed port collision and a source of network
changes; it does not prove what triggered every Chrome error in the failed run.

The next no-grants route must retain a clean browser-error checkpoint at earned
readiness before extending into full Verdant combat. Keep this failure recorded.
The previous route remains failed regardless of the new result. An enabled
dungeon button is not an earned dungeon clear or human pacing assessment.
