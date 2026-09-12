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

## Proposed 1.1 patch-note text

Weak Point Mark, Smoke Bomb and Cloak & Vanish Techniques now reduce their mana
cost instead of granting critical chance to non-damaging skills. Existing ranks
and cooldown benefits are retained; their tooltips show the actual bonuses.
