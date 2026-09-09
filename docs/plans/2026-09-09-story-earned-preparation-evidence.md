# Story-only Earth readiness: earned preparation baseline

## September 9, 14:48 — acquisition replay and milestone travel

218a0b7 run20538 completed with a FAILURE after16.0m, not a full readiness
pass. Preserved complete report, images and sanitized log at
`/tmp/eidolon-story-milestone-travel-failure-OV9pLT`; scanner0 and exact owned
containers/image/ports absent. Viewed failed-collection.png: level10, Imp quest
2/60, character still in the western field. No production resources were touched.

The first40-kill hunt passed, including manual1593XP/100gold claim and exact
saved progression (0deaths,15town visits,607s through claim). Eight Memory Seeds
were collected after19selected-target death observations, then manually consumed
for the reward, reaching level9. These observations are not a statistical drop
rate sample. The Imp segment produced23 outgoing damage events/reported775 and
reached level10. Retained receipts show actual60fire/5physical hits, independently
of ability acceptance. Do not count reported damage as net enemyHP drained.

The level-ten preparation path called openDungeonGuide from the field; its four
short approach steps cannot replace cross-world travel. It failed the existing
20s visibility check near x-183,z211. Preparation now performs ordinary Recall
and verifies town arrival before the guide approach and existing earned training.
No input teleport, grant, relaxed encounter watchdog or reduced hunt requirement.

Repeated ranged/Fighter driver installation also reproduced duplicate diagnostic
cast counts in unit tests (one accepted result counted twice). Each now resets
its segment while installing one wrapper per game object; messages are forwarded
unchanged. This does not retroactively establish exact cast totals in old runs.

RED:3suites failed, including both duplicate-count assertions and the new missing
route helper. GREEN:38tests/5suites1.197s and lint passed in71991, logs
`/tmp/eidolon-story-milestone-{before,after,lint}.log`. Actual corrected training
and remaining story-only Earth playthrough still require a fresh browser run.
Recovery58 remains unchanged and excluded from these edits.

The prior a4ea4cc run failed in the level20+ Imp hunt, starting at level9 and
only training when a hunt started at10+. It did not log unspent points or actual
damage targets. Preserve `/tmp/eidolon-story-ready-imp-failure-mptII0`; do not
interpret the fabricated hover-panel damage estimate as a server hit receipt.

The ordinary-build baseline fills empty slots with already-earned eligible gear.
At10+ it uses existing earned branch/mastery training and saved-build verification.
All preparation records before/after progression and stats. This is one documented
baseline, not an optimized build or all-class proof.

Correction from actual evidence: online attributes grow automatically in
`World.awardExperienceLocked`; they do NOT award spendable stat points.
`Actor.increaseStat` rejects multiplayer and the character UI hides those buttons.
The new replay recorded0points atlevel3, matching that contract. The initial
speculative all-points early-preparation change was therefore removed; existing
offline/five-point helpers are unchanged. Do not blame the Imp failure on unused
online attributes. The missed level10 branch/mastery handoff still matters.

When a credited encounter earns a new ten-level training milestone, the driver
returns to town and trains through ordinary UI before resuming normal travel.
It never interrupts/restarts the120s encounter watchdog, adds a daily quest,
grants gold/XP/items/levels, changes a dungeon gate or relaxes the two-death bound.
Training stops are counted separately from ordinary resource-rest stops.

A read-only observer records actual server damage source, target, amount, kind
and current requested target, separately from accepted/rejected ability results.
Outgoing/incoming totals survive the bounded last100-event detail window.
Evidence is flushed before a training reconnect and at quest readiness/failure;
fresh reconnects start explicit new observer segments. It never changes gameplay
messages, hits, targeting or character resources. Stalled snapshots now include
unspent points, base stats and talent ranks.

RED:3focused suites failed before implementation (four early-budget assertions
and two missing helper modules), `/tmp/eidolon-story-preparation-before.log`.
GREEN:25cases/3suites0.665s and lint passed, logs
`/tmp/eidolon-story-preparation-{after,lint}.log`. bd8a347 fullclient/lint passed
275suites3932tests107.303s. The chained79981 browser replay FAILED3.8m during
the first hunt, before the Imp test: no reachable qualifying Skeleton after
bounded travel. Opening3kills26s/manualclaim35s; actualdiary80s; firsthunt0/40,
finalscreenshotlevel4. Archive
`/tmp/eidolon-story-preparation-travel-failure-xuRWfI`, scan0/exactownedcleanup.
The former observer dump only ran on one stall path, so this failure lacked its
retained hit detail. All story failures now attach the read-only player/nearby/
damage receipt, including search/travel errors.

Source inspection also exposes a no-input loop: a visible living target beyond
basic range+2 is repeatedly sent back to search, which can return the same
visible target, instead of normal target clicking/chase or ranged casting.
The driver now engages valid visible targets through normal inputs regardless
of basic range, and searches only for missing/dead/hidden targets. The120s credit
deadline, travel bound and server eligibility remain unchanged. This code defect
does not prove the entire prior travel failure had only one cause.
Focused regression41cases/4suites0.833s and lint pass, logs
`/tmp/eidolon-expedition-acquisition-{before,after,lint}.log` (before failed).
Corrected actual full story-only replay remains required. Server/game runtime,
balance and quest content remain unchanged; this is evidence-gathering work only.

Excluded from recovery58ef9a638 and its production pipeline. The first hunt's
level9→20 enemy step, solo/class/party readiness, overall curve and full raid
journey remain unapproved until actual play evidence supports them.
