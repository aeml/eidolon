# Stable status-training comparisons — QA correction

## Native acceptance — September 12, 2026

Native75575 on50d2ea57 completes all three serial cases with zero retries:
Shadow Lunge40.4s, Serrated Edges47.5s, Poison Coating50.6s. Baseline/trained/
saved tick sequences64→76→76,35→42→42,62→74→74 respectively. Every dispatch
and damage sample retains Dexterity109 and zero rest; all existing target,
paid-cast, rank and persistence assertions pass. Archive
`/tmp/eidolon-status-stable-pass-Ctfnxx`, scan0/exact containers/image/ports cleanup.
This closes the status arrival collateral for the scoped Tripwire candidate;
full healing-runtime CI34723986784 and fresh merged regression remain required.

Native46213 on25265056 fails Poison Coating's baseline exact tick. Diagnostics
prove the pre-aim Dexterity119 was rested; the coating request had0.758seconds
of Well Rested left. The ordinary Piercing Throw request and physical/poison
damage receipts instead have Dexterity109 and zero rest. The actual62poison
equals8+floor(109/2); the test expected67 from the earlier119 stat sample.
This establishes temporary-stat drift, not a failed Mastery consumer.
Archive `/tmp/eidolon-poison-budget-diagnostic-failure-HcXglF`, scan0/exact cleanup.
Preserve the earlier trained80-versus74 failure as diagnostic history too.

After each ordinary town return/waypoint departure, the functional training
route now waits for earned rest to expire naturally (bounded45seconds) before
aiming and sampling stats. No buff/resource/timer is set. All dispatch and
received damage samples must retain the same Dexterity and zero rest. Exact
tick formula, paid cast, real target/delivery, ranks0/5 and saved-login checks
are unchanged. This intentionally compares unchanging conditions; it is not a
new balance claim or a replacement for separate Well Rested lifecycle coverage.

Rerun all three affected status routes, not only poison. Full hosted and
integration acceptance remain separate; this test correction has no independent
player-facing patch note or release/version change.
