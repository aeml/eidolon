# Release45 prepared Wizard diagnostic

Base45b4b831a85c96992cd396344610cd1fb9175fd6 failed CI34192659636 in the
predeploy character gate; deployments were skipped. Fresh public client manifest
still identifies Alpha1.0.44 /847d454a94a7424ab303f6339c875ab170bff36e.
Do not retry unchanged CI or publish46 before resolving45's gate.

The ordinary Verdant fixture selects Fighter skills/runes but never prepares
Wizard talents or runes. Its level100 Wizard reached Rootbound Warden15000HP with
391mana, then stalled at9074HP by the existing120s limit. Retry started with
809mana and ended at5462HP. Both observed real damage. The1205mana logged at
the earlier Skeleton was current mana, not maximum; the log had no maximum-mana
field. This is not evidence that all builds cannot clear the dungeon.

Candidate preparation spends only existing talent points on Fireball Mastery
(up to five ranks), and selects the existing Empowered rune if level-unlocked,
using ordinary UI clicks with server acknowledgements. It neither selects unused
specializations nor injects resources, equipment, damage, ranks or another level.
There is no added reconnect or mana refill. Fighter preparation and encounter
deadlines, stall watchdogs, survival assertions and spawn progression remain intact.
This is an experiment to repair prepared functional coverage, not a fresh-character
balance pass. The separate uninterrupted candidate still dies at the diary site.

New actual-dispatch server test4500 passes with passive-regeneration race tests
(3.063s). Canonical level100 Wizard has1685max mana: untrained Fireball emits
258raw damage for30mana/1s effective cooldown; rank5 plus Empowered emits618
for the same30mana but2.5s cooldown. Basic damage29, both0.01 regeneration
coefficients and point budget remain unchanged. Theoretical full-bar raw output
14448 versus34608 is not actual kill/encounter evidence (misses, travel, prior
spending and enemy interaction still matter). Empty-to-one-cast passive wait is
27.52s at109Wisdom. Existing preparation-policy15 tests and helper lint20741 pass.
An actual browser run on this frozen candidate is required before integration.

## Starting-ability rune authorization correction

Browser61816 on1af1ef0 failed20.8s while equipping Empowered, before dungeon
combat. All five ordinary Mastery purchases were acknowledged, but the rune
remained unset. Log `/tmp/eidolon-release45-wizard.log`; scan/owned cleanup
passed and the handle closed. Source inspection found an actual UI/server
mismatch: the UI treats Tier1 as unlocked, and casting permits the class's base
ability without specialization, but rune authorization only checked the empty
UnlockedSkills list. Choosing a branch incidentally populated that list.

Shared IsBaseClassSkill now supplies the same class-owned starting-ability rule
to casting and rune authorization. No new ability, specialization, damage,
cooldown or recovery is granted. Rune/skill matching and rune-level gates still
run first; other skills still require their explicit unlock. Actual45 notes now
describe this correction without replacing earlier history or changing identity.

New real-message regression covers all three base runes for each of four classes,
rejection one level before each unlock, acceptance at its level, unequip,
rejection of unselected branch skills and foreign-class skills. Initial27192
failed because a long sequence exhausted the normal per-client message burst;
each independent authorization case now has its own normal request client rather
than changing or disabling the production limiter. Corrected95910 passed root
race1.863s and broader game ability/rune/passive-regeneration race37.052s.
The corrected actual browser and full release regressions remain required.

## Full closure and resource-efficient prepared build

Frozen c812eee full client28151 passed216 suites/3193 tests/187.655s before
starting its browser. Full server57721 passed (root14.155s/database1.071s/
game330.668s), terminal. Browser28151 **FAILED5.0m**, terminal, scan/owned
cleanup passed. All five normal Mastery purchases and unbranched Empowered
selection were acknowledged. Rootbound Warden was defeated through real attacks,
later Skeleton encounters spawned and died, then Briar Matron outlasted the
unchanged120s limit. The last periodic sample showed1261HP remaining and the
player300/2575HP with29mana. It is not the exact final snapshot. Logs:
`/tmp/eidolon-release45-base-runes-client.log`,
`/tmp/eidolon-release45-base-runes-server.log`,
`/tmp/eidolon-release45-base-runes-browser.log`. No owned containers remain.

The next prepared build also buys existing Efficient Casting and Fireball
Technique, each up to five ranks, after Mastery. A pure planner validates the
available point budget, respects existing ranks/caps, and never resets a build
or grants points. The browser clicks the actual talent nodes and requires each
server point/rank acknowledgement. At level100 this uses15 of20 available points.
No production combat numbers changed. The same real-dispatch test now includes
this build:618raw Fireball damage costs21mana with2.125s effective cooldown,
5points remain, basic damage29 and both regeneration rates are unchanged.
Focused server9238 passed1.636s; client59067 passed236 tests/two suites/2.554s
and helper lint. A subsequent tiny planner guard rejects NaN ranks explicitly;
its new regression and the next full client/browser checks remain required.
This still does not approve a fresh level30 clear or uninterrupted campaign.

## Corrected local release gate passed

Frozen d176b62 full client46538 **PASS217 suites/3212 tests/206.821s**.
Corrected actual browser88089 **PASS one/4.6m test/4.7m reported run**, terminal.
Ordinary UI bought15 talent ranks from20 points and equipped Empowered. The
Wizard defeated Rootbound Warden15000HP and Briar Matron16800HP, along with
the intervening generated encounters. The last Matron sample showed364boss HP
with player1015/2575HP and336mana before the confirmed death. The unchanged
route verified both cleared boss rooms, increased gold, and dungeon exit.
No death, deadline extension, resource grant or reconnect was added. Artifact
credential scan and owned cleanup passed; absence of the owned containers was
independently checked. Log `/tmp/eidolon-release45-efficient-browser.log`.
All owned test handles are closed. Latest server runtime remains identical to
the passing c812eee full race run; its added training test passed separately.

This closes the local prepared functional gate, not the first-hour or full
four-dungeon/raid campaign balance gates. Publish this explicit45 branch as a
fast-forward of remote45b4b83, never root's staged52. Production CI and fresh
exact public client/backend checks are still required before calling45 live or
publishing46. The requested0.01 rates and actual45 rune correction notes are
included; later version identities are not imported into this package.

## Phone talent observation correction — September 8, 08:12 UTC

CI34198772605 on64df5fb failed predeployment; all deployment and live jobs were
skipped. Client/server/browser smoke passed. The actual prepared Verdant run
defeated Rootbound Warden and Briar Matron; the later phone talent-economy route
failed waiting30seconds for a full mana bar after login. Its automatic retry
then expected an untrained30mana cast on the reused, already-trained character
and observed21. These are distinct test failures, not proof of a failed deploy.

Test-only source **42522f055151539ac15a7a2dadd839edff7210ef** waits for sufficient
mana, measures the actual pre-input mana (not maximum capacity), and bounds only
possible intervening regeneration ticks when checking the server receipt.
Full-bar casts still require exact payment; undercharging, no charge and invalid
observations are covered. Retry uses its own allowlisted fresh character and
asserts both relevant talent ranks start at zero. A deliberately failed probe
after purchases proves the subsequent retry can pass its untrained baseline.
No runtime/server/src/login/patch-note content or regeneration coefficient changes.

Focused238tests/2.879s; final resource/retry checks15tests/1.210s; full client
**218suites/3221tests/137.186s**, full lint, shell syntax and diff checks all pass.
Current production server code is identical to64df5fb; targeted actual talent
cost and passive regeneration race tests pass3.992s. Full Go is not claimed
rerun for this test-only correction (the same server passed CI).

Actual phone cast route passes **11.6s /14.4s total**:30mana before training,
21after training,21after saved login. Crucially, that login restores1191/1685mana,
not a full bar, with1.09mana/second recovery; waiting30seconds to fill the missing
494mana is an invalid requirement. This finding does not change login recovery
policy or approve earned progression. The retry-isolation probe deliberately
fails its first attempt after purchases, then passes its fresh retry in11.1s;
the reporter correctly labels that intentional probe "1 flaky". Both scans
pass0sanitizations, both disposable cleanups and independent container absence
pass. Handle72433 terminal0; full client/lint93578 and server46965 terminal0.

Logs `/tmp/eidolon-release45-cast-observation-{client,lint,gameplay,retry}.log`.
Do not rerun the unchanged failed64df5fb CI. This corrected45 must fast-forward
the remote64df5fb, then pass the complete CI and independent public gates. Later
46–52 candidates must inherit this correction before publication. Full roadmap
and first-hour balance remain open; no45 live success is claimed here.
