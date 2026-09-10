# Finish actual fragment pickups before the next prepared encounter

September10 replay12987 on752c888 verified all8 naturally collected Seeds and
manual consumption in stage1 (4.6m), then the full Imp/scar stage (6.9m). It
later failed a second-stash capacity assertion at41/50DemonOrcs, not collection.
See the [storage follow-up](2026-09-10-earned-stash-preservation.md) for the
retained evidence, actual first deposit and correction. Full-chain acceptance
and fresh-player balance remain open; this pass does not retrospectively prove
which specific fragment was abandoned in the earlier failure.

Run49128 on370f029 reached the game successfully, then failed stage1 after3.5m
with7/8Seeds after40encounters. Opening, diary and40Skeletons were complete; no
daily was accepted. One equipping-only visit freed11slots. No stash transfer
occurred, so this run does not validate the new stash path. Full health and7free
bag slots remained. Archive `/tmp/eidolon-earth-seed-budget-proof-9gBFvf`, wrapper
sanitized0files/supplemental scan0, whole-world screenshot inspected, exact owned
services/18560/18561/41960cleaned. Log `/tmp/eidolon-earth-stash-diag.log`.

An initial interpretation incorrectly used a20%drop rate from stale context.
Current `ChronicleDropForKill` is35%for new CollectionVersion2 contracts, with
fourmisses guaranteeing the next qualifying drop. Legacy accepted contracts
retain65%. Do not adjust runtime drops or extend the test's encounter limit to
address this failure under the incorrect probability assumption.

The inspected functional helper made at most one10unit movement toward a ranged
death and immediately returned to the next waypoint. The movement helper only
confirms displacement, not arrival. It also threw after the final allowed kill
without checking whether that kill had completed the objective. By comparison,
the fresh route walks fully to each death and gives pickups time to resolve.
Server world-drop accounting reserves outstanding personal fragments against
the missing objective count, so leaving one behind can prevent replacement rolls.
The old failure receipt did not capture ground fragments: a specific abandoned
Seed remains a source-supported hypothesis, not an observed fact.

## Change and preserved constraints

Use bounded ordinary move-only ground clicks until the actual death location is
within2units, waiting for each ground destination to finish. Allow the existing
fresh-route900ms publication/pickup interval, then require nearby quest drops and
pending pickup requests to drain through normal auto-loot. Check the actual
objective once more after the final permitted encounter. Capture replicated
quest-drop positions/range/pending status and auto-loot state on future failures.

No teleport-to-item, forced loot/kill, network pickup injection or inventory/quest
writes. The existing40Seed encounters,600-second stage ceiling, manual turn-in,
eight-item consumption,150hunt kills and all stash/fresh-play gates stay intact.
The prepared level and ordinary QA encounter travel remain explicitly labeled;
this is not a fresh-character balance result.

- [x] Full client/lint after the pickup correction and startup-diagnostic additions.
- [ ] Complete actual serial replay, including natural collection and stash use.
- [ ] Separate fresh-character readiness, classes/groups and dungeon/raid play.

Focused63729 passed29tests/4suites0.715s+lint. Full same-session regression on
e0cbb32 passed286suites4011tests86.196s and lint, including the startup diagnostic
tests. Logs `/tmp/eidolon-fragment-pickup-full-{client,lint}.log`. Actual replay
remains required; no discarded fragment or successful stash transfer is inferred
from unit results.
