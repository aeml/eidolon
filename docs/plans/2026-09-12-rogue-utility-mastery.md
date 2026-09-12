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
