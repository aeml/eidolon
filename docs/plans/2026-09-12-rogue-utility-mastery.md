# Rogue utility Masteries — candidate for 1.1

Weak Point Mark, Smoke Bomb and Cloak & Vanish have no direct damage, but their
saved Masteries ROG_05/19/25 advertised and supplied a damage multiplier. Following
the existing support-Mastery design, each rank now extends the existing effect
duration by 4%, up to 20%. Saved IDs, maximum ranks, point costs, mana, cooldowns,
rank-zero behavior and authored rune bases remain unchanged. No damage, new
control effect or stealth mechanic is added.

The named duration adds to Dirty Tricks, after rune base duration selection.
Server paid casts already resolve named duration bonuses; offline casts now do
the same for the mark, both smoke debuffs, cloak stealth and Swift burst. Applied
effects snapshot their duration once. Replicated timers are not scaled again.
Offline saved padded/unpadded IDs take the maximum rank, not a double investment.

Regression evidence: initial client RED 10 failed/4 passed; initial server RED
also exposed missing trained durations. The first server GREEN attempt failed
12 Smoke cases because its synthetic enemy had health10000 but zero base vitality:
the ordinary slow stat recalculation produced maxHealth0. The diagnostic proved
the cast was accepted and paid the correct35mana. The corrected fixture uses
base vitality1000, derives health normally, and checks BOTH current and maximum
health stay unchanged. No runtime stat rule or no-damage assertion was relaxed.

Corrected server race check passed6.361s across purchased ranks0/1/5 and generic
ranks0/5, with rune deadlines and exact point/mana accounting. Expanded client
7suites97tests passed2.381s; full lint and diff checks passed. Logs:
`/tmp/eidolon-rogue-utility-{client-red,server-red,server-green,fixture-diagnostic,server-corrected,expanded,lint-corrected}-20260912.log`.

Full CI and actual saved-rank native casts remain required before acceptance.
This does not close the other160-talent audit: Rogue utility Technique crit copy
and Blade Storm's true area semantics remain separate unresolved work. No version
or live release has been published by this candidate.

## Full runtime CI and authored native purchase route

Runtime5a0983df full CI34696690782 SUCCEEDED:399client suites6304tests114.239s,
game86.9%/96.780s, race311.800s, all browser shards40+53+26=119actual checks.
Logs `/tmp/eidolon-rogue-utility-ci-{client,server,browser1,browser2,browser3}-34696690782.log`.
Native and production jobs were skipped by manual CI; this is not native or
live acceptance.

New `rogue-utility` route is now authored and included exactly once in full QA,
using a dedicated allowlisted account with zero Playwright retries. It selects
normal branches, purchases each named Mastery0→1→5 plus Dirty Tricks5 within
the level10020point budget, and selects Lasting Shadow through the rune UI.
Desktop's optimistic purchase preview is not evidence: a serialized observer
requires real owner wire ranks and exact point spending. Reinstall/reset never
nests message wrappers and missing target/active/duration fields cannot invent
success or expiry.

Each paid mark/smoke cast walks to a real ordinary hostile through move-only
ground inputs and confirms actual hover; Cloak targets the owner. Level,
waypoint and animation readiness only prepare cast conditions, not earned
progression or survival balance. No enemy, rank, timer or cast result is assigned.
Tests require exact mana, real matching cast receipts, observed duration,
actual actor timer, attached High/Low status geometry and natural authoritative
expiry/removal. Hostile health must stay unchanged. First duration sample must
be within0.15s below expected: the wider0.75s allowance used for longer buffs
would incorrectly admit a missing0.2s rank-one Smoke/Cloak benefit.

A fresh login preserves all20 ranks, zero remaining points and Lasting Shadow;
all three final casts use named+generic training (mark14s, smoke7s, cloak14s).
Base ranks0/1/5 cover both High and Low. This route does not separately prove
Smoke accuracy duration or Swift burst through network fields that do not
replicate those individual timers; exact server paid-effect tests cover them.
Actual full execution remains queued behind the sole party browser lane.

Observer/route RED1fail4pass before enrollment. Focused3suites69PASS5.741s;
expanded4suites89PASS7.063s, plus actual AttachedStatusEffect20PASS2.921s.
The initial expanded command included a nonexistent pluralized status test
name; it ran only4suites, not5. The separately discovered real file above was
then executed. Full lint/assets/shell/diff passed; Playwright listing finds the
single scenario without executing it. Logs use
`/tmp/eidolon-rogue-utility-native-{red,tests,expanded,attached,lint-final,assets,list-final}-20260912.log`.
Combined authored-route CI and native results remain required before integration.

First native40445 on frozen d13194ba FAILED28.4s: the first rank-zero Weak
Point cast produced TWO ability-result messages where the test required one.
This is not a missing receipt, successful duration proof or diagnosed runtime
cause. Archive `/tmp/eidolon-rogue-utility-first-failure-GMQao6`; original
`/tmp/eidolon-rogue-utility-native-20260912.log`. Scan0/owned services/ports clear.
The initial failure lacked full result payloads. A diagnostic-only follow-up
retains the strict assertion and captures both payloads, cast messages, input
focus/pending target/cooldowns and a failure screenshot before rethrowing. No
retry, timer, cast count or runtime rule is changed. The next native replay is
required to distinguish duplicate dispatch from admission/other causes.

Diagnostic81689 onf40689b2 FAILED13.4s earlier in acquisition: the live target
had moved to5.7306units during post-approach readiness chat, outside the retained
5unit cast-position assertion. No cast-result payloads were reached, so the
earlier TWO-results cause is still unresolved. Archive
`/tmp/eidolon-rogue-utility-moving-target-failure-q2lw4m`; original
`/tmp/eidolon-rogue-utility-diagnostic-native-20260912.log`. Scan0/cleanupPASS.
Readiness now precedes normal approach, with unchanged range, cast count and
duration assertions. Diagnostic observer tests still pass; native replay remains
required and is not a retry that erases either failure.

Readiness-order18728 on1a23887d FAILED43.3s with the needed diagnostic. Both
result entries were identical accepted Weak Point casts,1718mana after1743,
6s cooldown; both ability entries were identical. Actual base mark peak9.9831s
and natural expiry were observed. This does not accept the overall route.
Archive `/tmp/eidolon-rogue-utility-duplicate-failure-YgaHUJ`; original
`/tmp/eidolon-rogue-utility-readiness-native-20260912.log`, scan0/cleanupPASS.

Cause reproduced in a unit regression: moveByGroundClick installs the entrance
click observer around the current receiver. That outer function does not copy
the utility observer's function-property marker. Installing for the next cast
therefore nested a second utility observer; both append to the same fresh
observation. Core delivery still happened once. Store installation ownership on
the game/document, preserving all outer observers and fresh-login resets.
Regression RED1fail5pass; composed observer/input/runtime/stage tests4suites77
PASS4.975s/lint/diff. Logs
`/tmp/eidolon-rogue-utility-composed-observer-{red,tests,lint}-20260912.log`.
No gameplay/runtime/count assertion changed. Corrected native and CI remain
required; earlier failures remain preserved.

Composed-observer6920 on2e19276d FAILED50.2s at the first talent purchase.
Rank-zero Weak Point Mark paid cast, actual attached High effect,10s wire/local
duration and natural expiry passed; no duplicate records recurred. Locator used
`Weak Point Mark Mastery`, but the catalog/visible label is
`Weak Point Mark - Mastery`. Archive
`/tmp/eidolon-rogue-utility-talent-label-failure-5Digc5`; original
`/tmp/eidolon-rogue-utility-composed-native-20260912.log`. Scan0/cleanupPASS;
main agent viewed the retained base-cast screenshot. Its incidental22FPS is not
a performance acceptance result.

Purchase labels are now resolved from the actual CONSTANTS catalog by stable
talent ID, rather than guessed strings. Actual normal UI clicks and independent
server rank/point assertions remain unchanged. Two suites20tests pass2.49s,
changed lint/list/diff pass; log `/tmp/eidolon-rogue-utility-catalog-tests-20260912.log`.
Corrected native execution is still required, not credited to the failed run.

## Corrected native acceptance

Session1494 PASSED5.1m test/5.2m total with zero retries on exact
ab202a677c280670eea4a9a9aa529368d3d3551a. All three skills passed rank0/1/5
normal purchases, exact paid casts, High/Low attached effects and natural expiry.
Fresh login retained all20 paid ranks and the selected Lasting Shadow rune;
named+Dirty Tricks mark14s, smoke7s and cloak14s passed. This is prepared
level100 QA, not earned progression, combat survival or full talent acceptance.
Smoke accuracy and Swift burst remain server-test coverage, not separate native
timer claims. The earlier four failures above remain in the record.

Archive `/tmp/eidolon-rogue-utility-catalog-pass-YSeiyL`; log
`/tmp/eidolon-rogue-utility-catalog-native-20260912.log`. Credential scan0 and
independent owned-container/18185/18186/41875 cleanup checks passed. Main agent
viewed the saved High cloak capture; incidental12FPS is not performance closure.
Exact-source CI34699201516 is queued/running; full corrected CI is still required
before primary integration. No production release follows from this local pass.
