# Expanded story: retained attack input and streamed-target recovery

The unchanged 6c81285 experiment finished actual session85183 FAILED,11.9m,
QA_SCRIPT_EXIT=1. Opening passed67s/three kills/no deaths/100XP; diary passed120s
with25gold/200XP. Neither checkpoint reconnected or restored mana. The current
source already activates progression version2 and31chapters; it is not the old
curve1/15chapter release. Published progression remains a separate release gate.

The40-kill Watch reached6credits with one ordinary death,14 accepted Fireballs
and178retreats. At failure the level4 character was alive175HP, x=-278/z187,
hovering an Imp, and the original Skeleton was no longer streamed. No credit
arrived within the unchanged120-second watchdog. This is not campaign/pacing
approval. Log `/tmp/eidolon-story-pursuit-current-gameplay.log`; credential scan0
and independent exact-container/network absence confirmed after normal cleanup.

This QA-only successor retains normal click-owned attack/chase, following the
actual ray-selected actor instead of re-clicking moving silhouettes every250ms.
The hunt retains that living selection unless an immediate nearer threat requires
defense. With no live target, ordinary level-appropriate travel reacquires an
enemy under the SAME remaining watchdog, not a fresh deadline. Credit continues
to come only from actual server quest progress;40kills, two-respawn limit,
authored lore/rewards/curve2 and .01 regeneration are unchanged.

The helper's first test run exposed two test API mistakes (unsupported Jest
matcher and jsdom URL); corrected16target/selection tests passed1.015s, then
full lint/diff passed. Additional bounded-reacquisition assertions and final
verification follow. Actual successor gameplay is still required. This branch
is based on the experimental story tree, NOT a successor to queued release55;
do not publish its historical Alpha1.0.50 metadata or replace the release queue.

Second actual42789 on2ae3849 CLOSED FAILED5.3m, QA_SCRIPT_EXIT=1. Opening113s
with one ordinary death, diary165s; no checkpoint reconnect. Watch earned2/40,
then stalled with player150/150HP, original Skeleton27HP at70.44distance, still
alive/moving.18retreats/two actual crowd jumps/no Fireballs (mana17atstart).
This is a distant disengaged-target case, not only a missing-streamed actor.
Log `/tmp/eidolon-story-retained-target-gameplay.log`; scan0 and independent
owned-container/network absence passed. It does not approve balance or prove
the input correction alone sufficient.

Follow-up reuses the verified collection strategy: healthy ranged characters
finish normal basic attacks until below80%HP; other callers retain their prior
retreat defaults and shield behavior. Distant original targets with no active
attack/chase are reacquired through level-appropriate real travel under the same
120s watchdog. Requirements/rewards/regen and two-respawn bound are unchanged.
68focused strategy/target tests PASS1.509s, plus full lint/diff (30547). Earlier
27-test call had two signature-expectation failures; a new test also needed the
existing Jest-only Playwright mock. Both are corrected, no assertion removed.
Actual follow-up remains required; no gameplay runtime changed.

Third actual60075 on a4632b5 CLOSED FAILED2.5m in the opening before the modified
Watch strategy ran. Two kills passed25s, then the same120s watchdog failed with
85HP/22mana, living Skeleton22HP at29.76distance. Log
`/tmp/eidolon-story-healthy-combat-gameplay.log`; scan0/exact-container absence
confirmed. It neither validates nor disproves the new healthy Watch strategy.

The opening now also uses the already verified collection-route disengagement
rule: retain active attack/chase, but reacquire a living distant target when no
attack is selected. Normal bounded travel shares the existing deadline. Four
new direct helper tests preserve near/selected/dead observations;72focused tests
PASS1.959s with full lint/diff (18213). Actual successor remains to run.
