# Release46 recovery-input correction

CI34215073108 on b2016ef ended FAILED in Predeploy Character QA. Server/client/
anonymous browser jobs passed; validation and both deployment jobs were skipped.
The failure was dungeon-wipe-recovery-gameplay on both attempts, seeds
214149699972850271 and1425612774346219180, generator2, Wizard30. The helper
reported attempts=[] while an earlier ordinary move continued about10units;
retry health already reflected damage. The test issued the next12-unit relative
step after observing only1unit of the previous step, with the camera still moving.
This is evidence of an input-sequencing problem, not proof of broken collision.

Correction waits for the issued ordinary step to settle (or real hostile damage/
death) before calculating another click. Approach stops once an actual incoming
damage receipt confirms contact; assertions still require positive hostile hits,
DEAD, rejection of Recall while dead, visible Respawn and same unfinished seed/
room state on normal guide re-entry. No health grant, protection, teleport, jump,
direct state write, relaxed death requirement or runtime change. The90s approach
and300s total deadline remain. Actual isolated recovery must pass before a new
46 push; do not rerun the unchanged failed CI revision.

The same CI log also contained an earlier flaky Verdant preparation purchase
(expected1remaining talent point, observed2), which passed on retry. It is not
the terminal gate failure and remains a separate observation for follow-up.
