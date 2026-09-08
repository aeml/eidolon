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

## Next gate failure: Wizard preparation and survival

CI34220869395 on86609cd is terminal failed. Server/client/anonymous browser
checks passed; both deployments and live QA were skipped. The first Verdant
attempt stalled on a talent purchase (expected3points, observed4). Retry bought
four ranks successfully, then died fighting Briar Matron: seed1570147807148210973,
generator2, prepared Wizard100, normal level30. Periodic receipts show real boss
damage from16800 to962HP, while mana fell from390 to7 and the player died.
This is not a targeting stall, nor proof of a healthy encounter balance.

The prepared route had no defensive input callback. The earned-route Wizard
callback also assumed six-unit center-distance retreat for every enemy, while
the server's scale4 boss has7.5-unit melee reach. Reuse normal defensive inputs
in the prepared route and make the existing planner compare clearance from the
actual scale-adjusted melee range. Preserve wall-safe movement, point/resource
budgets, damage-stall/deadline and zero-death assertions. No runtime code changes.
38 focused tests and lint pass; actual dungeon verification remains required.

Talent preparation now observes outgoing unlock requests and classifies server
errors on failure, without retrying a purchase, relaxing acknowledgement checks
or writing character state. The cause of the intermittent lost purchase remains
unproven; optimistic desktop rank mutation and DOM replacement are leads, not a
confirmed fix. Do not publish this candidate solely on unit-test evidence.
