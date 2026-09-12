# Rogue utility Techniques — 1.1 candidate

Weak Point Mark (ROG_06), Smoke Bomb (ROG_20) and Cloak & Vanish (ROG_26)
have no direct damage, making their named critical bonus unusable. Replace that
bonus with the existing Wizard Technique economy model: +3% named cooldown
reduction and -2% named mana cost per rank, capped at15%/10%. Preserve saved
IDs, five ranks, one point per purchase, rank-zero behavior and utility durations.
The corresponding duration Masteries remain independent. No new damage, stealth
or control mechanic is introduced. Other Rogue Techniques remain under audit.

Both client and server already consume named mana modifiers; only catalog data
and visible copy change. Shared160-talent economy and critical contracts now
support per-Technique overrides so the three exceptions remain explicit without
removing checks for other classes or skills.

Tests first failed on the old runtime: client10 failed/31 passed; server exact
discounted costs were rejected and utility critical bonuses remained nonzero.
The initial server fixture also incorrectly forced derived global CDR to zero;
Cloak recalculates stats during the real cast. Corrected the fixture to use its
lawful derived stats and include that independent CDR in the expected cooldown;
the corrected RED still rejected discounted ranks. Logs:
`/tmp/eidolon-rogue-utility-technique-{client-red,server-red,server-fixture-red}-20260912.log`.

After the catalog change: client4 suites/55 tests pass4.404s; focused server race
tests pass28.308s, including normal rank0/1/5 purchases, exact-cost admission,
one-mana-short rejection, cooldown rejection, unchanged effect duration/no damage,
equipment-first integer rounding and other-skill/class isolation. Existing
Mastery and shared critical/economy tests remain passing. Full lint/diff pass.
Logs `/tmp/eidolon-rogue-utility-technique-{client,server,lint}-20260912.log`.

Full CI, saved native Technique purchases and merged regression remain required.
Do not credit the separate Mastery native test as Technique verification. This
is development work, not a released1.1 or completed160-talent audit.

CI34699578801 on a1987d93 failed client2 suites/7 tests (398 suites/6304 tests
passed); server passed. The existing full offline cast matrix had not consumed
the new per-Technique contract overrides, and the multiplayer Smoke fixture
still supplied35mana expecting zero after a now31mana cast. Update that contract
consumer and exact fixture cost; retain all cast, cooldown and rejection checks.
Failure log `/tmp/eidolon-rogue-utility-technique-ci-client-34699578801.log`.

The candidate now reuses the separately verified Mastery route and receiver
through a distinct `rogue-techniques` route/account. It buys each Technique at
rank0/1/5, asserts paid server mana and cooldown independently of local prediction,
retains High/Low utility visuals/durations/expiry, buys Lightstep5, then verifies
all20 points and rune training after a fresh login. No Mastery rank is assigned
or credited to this route. Both routes remain enrolled exactly once in the full
predeploy stage ledger; the Mastery route keeps its prior duration assertions.
Six focused suites113 tests passed5.483s before the two old consumer corrections;
final expanded checks and native execution are still required.

Expanded client checks now pass8 suites/330 tests/4.657s, including all52 actual
offline skill consumers across baseline/ranked/generic combinations and the
multiplayer override fixture. Full lint, shell syntax, both native profile lists,
prepared client assets and diff checks pass. Logs
`/tmp/eidolon-rogue-utility-technique-{final-tests,final-lint,native-list,assets}-20260912.log`.
Corrected full CI and both native profiles remain pending; no acceptance inferred.

First Technique native46603 FAILED1.4m ondf5b83ea. Mark rank0/1/5 passed actual
cost25/24/22 and cooldown6/5.82/5.1, unchanged10s duration/High-Low/expiry. Before
Smoke's baseline cast, target moved to5.4403units during hover acquisition and
the unchanged `<5` range assertion correctly stopped the test. No Smoke cast,
saved Technique or full route success. Archive
`/tmp/eidolon-rogue-technique-first-failure-j7oKzi`; original
`/tmp/eidolon-rogue-utility-technique-native-20260912.log`; scan0/ownedcleanupPASS.

The approach loop now includes hover acquisition and rechecks the same target's
living identity and distance<4 before returning. If projection/hover lets the
enemy walk out, continue ordinary movement/reacquisition within the original60s
deadline before any cast. Final<5, paid-cost, cooldown and all effect assertions
remain. No target freezing, teleporting or cast retries are introduced.

## Technique pass and Mastery regression failure

Session25285 PASSED3.9m/4.0m with zero retries on8fe4117b. All three Techniques
passed normal rank0/1/5 purchases, exact paid costs/CDR, unchanged duration,
High/Low attached effects and natural expiry. Fresh login retained all20ranks
including Lightstep5; final costs22/31/27, cooldowns4.5/7.5/11.25s, durations
10/5/10s with saved LastingShadow. Archive
`/tmp/eidolon-rogue-technique-paid-pass-WsFy8P`; original
`/tmp/eidolon-rogue-utility-technique-reacquire-native-20260912.log`; scan0/
ownedcleanupPASS. Main agent viewed the Low Smoke capture. This is prepared QA,
not earned progression or completed talent/party balance.

The same-source Mastery regression51689 FAILED3.8m, after all three rank0/1/5
cases and saved Mark14s passed. Saved Smoke's wire-duration checks passed, but
the subsequent local timer assertion never observed>5.5s (eventually0 after
its15s observation timeout). This is not yet attributed to stale replication,
missed sampling or a gameplay regression; capture local timer/effect history
alongside the existing wire observer before another diagnostic replay. Do not
weaken the timer check or credit the older Mastery component pass to this build.
Archive `/tmp/eidolon-rogue-technique-mastery-failure-kdPvaf`; log
`/tmp/eidolon-rogue-utility-technique-mastery-regression-native-20260912.log`;
scan0/ownedcleanupPASS. Exact CI34705771836 remains active at this entry.

## Proposed 1.1 patch-note text

Weak Point Mark, Smoke Bomb and Cloak & Vanish Techniques now reduce their mana
cost instead of granting critical chance to non-damaging skills. Existing ranks
and cooldown benefits are retained; their tooltips show the actual bonuses.
