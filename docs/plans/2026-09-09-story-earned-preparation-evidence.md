# Story-only Earth readiness: earned preparation baseline

The prior a4ea4cc run failed in the level20+ Imp hunt, starting at level9 and
only training when a hunt started at10+. It did not log unspent points or actual
damage targets. Preserve `/tmp/eidolon-story-ready-imp-failure-mptII0`; do not
interpret the fabricated hover-panel damage estimate as a server hit receipt.

The new ordinary-build baseline fills empty slots with already-earned eligible
gear and explicitly spends all available primary-stat points before each story
hunt. Below10 it uses the existing early inventory inputs; default five-point
preparation in other routes remains unchanged. At10+ it uses existing earned
branch/mastery training and saved-build verification, with the actual available
stat-point budget. All preparation records before/after progression and stats.
This is one documented baseline, not an optimized build or all-class proof.

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
`/tmp/eidolon-story-preparation-{after,lint}.log`. Fullclient/lint and the complete
fresh Wizard story-only readiness replay are pending. Server/game runtime,
balance and quest content are unchanged; this is evidence-gathering work only.

Excluded from recovery58ef9a638 and its production pipeline. The first hunt's
level9→20 enemy step, solo/class/party readiness, overall curve and full raid
journey remain unapproved until actual play evidence supports them.
