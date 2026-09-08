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

Actual isolated95930 on clean97a53ba failed before combat. Diagnostic showed
13 attempts, all13 outgoing requests, a rate-limit error, only12 accepted ranks
and8points remaining (expected7). Credential scan0 and driver cleanup completed;
this is now a reproduced transport-budget failure, not an assumed lost click.
MsgUnlockTalent permits10 requests per10s. Prepared input now waits1100ms before
each purchase, including the first when earlier tests may have spent the burst.
Point/rank acknowledgement remains mandatory; no automatic retry or runtime
limiter change. A regression reads the real server policy to catch drift.

35020 on clean8ac2e95 completed normally with exit0: actual Verdant route PASS
3.7minutes, generator2 seed1587624703800339911. All15 purchases and Empowered
selection were acknowledged. Rootbound Warden15000HP and Briar Matron16800HP
died to actual inputs; later mobs, cleared-room/gold assertions and normal town
return passed. Periodic combat samples remained2575/2575HP; the last Matron
sample had613mana. No combat resource refill/reconnect was added. This is the
prepared two-boss functional gate, not a full/fresh dungeon balance approval.
Credential scan0 and independent exact-container absence passed. Final44129
passed258 version/preparation/defense tests in1.470s; lint/bash/diff passed.
Both test handles are closed. Candidate retains46's existing patch notes and
version identity; only QA and this evidence changed from the failed86609cd.
