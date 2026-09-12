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
