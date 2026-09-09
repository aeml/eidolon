# Story-only Earth readiness: earned preparation baseline

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
