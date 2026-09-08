# Crystal collection pacing and saved contracts

September 7, 2026. Runtime `f66f50d` implements the first collection slice of the
[progression balance plan](2026-09-07-progression-balance-and-investigations.md).
This is not the complete XP, equipment-drop, economy or investigation pass.
The first-dungeon time target remains provisional; no broad pacing sign-off.

## Rules and compatibility

New elemental collections require **eight** fragments, with a **35%** ordinary
eligible-kill drop chance. After four eligible misses the fifth kill guarantees
one fragment. The designated realm guardians still guarantee one. Wrong-source
kills, unaccepted/completed objectives and invalid random rolls cannot consume
the guarantee. Generated items stack to the contract's required count; ordinary
pickup and manual Ilyra completion remain mandatory.

Accepted legacy contracts keep their old target count and 65% ordinary rule.
Completed chapters retain progress and receipts. Newly offered/unaccepted
chapters receive current rules. Collection version and bounded miss count pass
through the production character snapshot, BSON fields and login conversion;
missing version metadata means legacy rules, not a fresh version-2 contract.
Existing rewards and character levels are unchanged. Copy now consistently says
fragments prepare a future repair: the raid and Maelin's Vigil still restore it.

## Regression and persistence evidence

Five new behavior/migration probes fail before implementation **0.026s**; their
initial corrected pass is **1.024s** with the race detector. Expanded checks
cover all four realms, a forced worst-case forty-kill/eight-item sequence,
legacy migration idempotence, saved misses, exact drop thresholds, ineligible
and invalid rolls, and full-bag pickup without lost loot or false quest credit.
Snapshot → BSON → actual login mapper checks pass **1.527s**. The broader
Chronicle/quest/pacing set passes **5.121s**, backend root **8.364s**, and lint.

Seeded distribution probes use 2,000 independently completed new quests per
realm, calling the actual drop function. They report **20.08 mean eligible
kills**, **26 at the 90th percentile**, and **34 maximum observed** in that
sample; the adversarial test separately proves the forty-kill upper bound with
immediate successful pickup. The 35% base chance without pity would average
22.86 kills. These are eligible-kill distributions, not playtime promises.
Log `/tmp/eidolon-collection-distribution.log`, race-enabled **1.700s**.

Runtime `f66f50d` passes **215 suites / 3,185 client tests / 169.239s** and
the full game race suite **354.829s**. The genuine fresh Wizard opening and
collection route passes **2.4m / 2.5m total**, with no grants, no deaths, eight
physical seeds, manual consumption/reward and saved completion after reconnect.
Collection takes **102 seconds**, with 15 observed target deaths (not a claim
that these include every incidental area-attack kill). The unchanged 8,000-XP
payout reaches level 17; the Guide correctly remains locked until level 30.
Credential scan and exact disposable cleanup pass.

Logs: `/tmp/eidolon-collection-balance-before.log`,
`/tmp/eidolon-collection-balance-after.log`, `/tmp/eidolon-collection-core.log`,
`/tmp/eidolon-collection-server.log`, `/tmp/eidolon-collection-persistence.log`,
`/tmp/eidolon-collection-client.log`, `/tmp/eidolon-collection-full-game.log`,
`/tmp/eidolon-collection-earned-gameplay.log`.

## Concurrency correction before packaging

A targeted refresh-versus-combat probe exposes a real race not reached by the
first full suite: quest metadata refresh reads the collection while the
combat goroutine updates its miss counter. Red result **0.968s**, log
`/tmp/eidolon-collection-refresh-before.log`.

Refresh, acceptance, completion and pickup now take the player lock within the
world lock, consistent with the existing combat and snapshot order. Quest request
and acceptance serialization also hold matching read locks. Chapter access reads
only its relevant fields rather than copying the mutable entire quest value.
Ten repeated race probes pass **6.762s**; Chronicle/quest/pickup/inventory/weekly
checks pass **6.055s**, backend-root race **13.627s**, and five actual dispatch
versus combat repetitions pass **4.199s**. Logs:
`/tmp/eidolon-collection-refresh-after.log`,
`/tmp/eidolon-collection-locking-core.log`,
`/tmp/eidolon-collection-locking-server.log`,
`/tmp/eidolon-collection-dispatch-race.log`.

## Alpha 1.0.47 package — locally verified

Package **`f18dfcb`** adds distinct **fragments worth finding** patch notes and aligns the login, package,
manifest and deployment/server defaults. The package includes the previously
verified weekly full-bag economy-accounting correction without changing its
payouts. Full predeployment QA now retains the genuinely earned collection
route, using its own disposable character and a separate fresh retry identity.
The route retains the level-one/no-grants assertions and captures the actual
ready-to-turn-in conversation. Contracts pass **237 / 1.721s**, and lint passes.

Final checks pass **215 suites / 3,187 client tests / 156.667s**, full server race
(root **19.922s**, game **330.735s**) and all **75 anonymous browser checks /
7.9m**. The final packaged earned route passes **2.5m**, with **109 seconds**
collection time, 22 observed target deaths, zero deaths, eight real fragments,
manual reward/consumption and saved completion after reconnect. Its ready-screen
image was cleared by the following browser sweep before inspection; no visual
claim is based on that lost artifact.

A fresh repeat on the same exact package passes **2.4m / 2.5m total**, collecting
eight fragments over 20 observed target deaths in **110 seconds**, with zero
deaths and successful manual turn-in/reconnect. Both runs retain the still-high
8,000-XP reward and correctly stop short of the level-30 dungeon gate at level
17. Both credential scans and disposable service/data cleanups pass.

The repeated run's actual ready conversation is inspected: clear eight-fragment
objective, **8/8** progress, **100 gold / 8,000 XP**, cap-conversion explanation,
and a readable explicit **Complete Quest** button. The independent image copy
is retained at `/tmp/eidolon-release47-earned-collection-ready.png`; this is a
desktop capture, not physical-phone or sustained-performance evidence.
All owned local handles are terminal success. Logs:
`/tmp/eidolon-release47-client.log`, `/tmp/eidolon-release47-server.log`,
`/tmp/eidolon-release47-anonymous.log`, `/tmp/eidolon-release47-gameplay.log`,
`/tmp/eidolon-release47-visual-gameplay.log`.

This package is ready for root integration, not already published. Do not
publish ahead of the earlier sequential CI/live release gates. Broader
XP/loot tuning, surplus uncollected world drops, physical-phone review and the
eight investigation quests remain open; no completion claim is made for them.

## Revalidation with 0.01 regeneration — September 8

Combined source `206fac5cf35408b87d251088267624e9228289d4` inherits corrected
45 and verified 46 without changing the eight-fragment rules or legacy promises.
Full client checks pass **218 suites / 3,226 tests / 199.594s**. Full server race
passes (root **17.468s**, database **1.048s**, game **337.916s**, other packages
also successful). Focused version/regeneration/prepared-build checks and lint
passed before the full runs. Handles 95541 and 38409 are terminal success.

Actual fresh collection handle **26108 FAILED / 4.7m**. The level-one Wizard
reports 0.1 HP/mana per second for ten starting stat points, confirming the
0.01 coefficient. Opening takes 43 seconds with no deaths and four retreats,
then its existing 500-XP claim and persistence reconnect produce level 5.
Collection reaches six physical fragment credits and level 6 after five observed
target deaths (incidental area kills are not included in that counter). It then
exceeds the unchanged two-respawn bound: the third observed death fails the run.
No completed collection, manual payout, final reconnect or ready-screen image
is claimed. Old higher-regeneration gameplay evidence does not validate this
combined package. **47 is not ready for publication.**

Log `/tmp/eidolon-release47-runes-gameplay.log`; client and server logs share
that prefix. Artifact scan passed with zero sanitizations, disposable cleanup
finished and exact API/Mongo container absence was independently confirmed.
There is no failure screenshot because this credentialed route disables automatic
captures; the error context proves the assertion but not the cause of the deaths.

Inspection finds the collection combat driver, unlike the opening/hunt driver,
issues repeated attacks without the existing ordinary Wizard spacing strategy.
Recovery does click the real death-respawn button and verifies town arrival;
it does not grant resources or reconnect. This is a concrete strategy discrepancy,
not yet proof that adding spacing resolves the failure. Gather combat/resource
and death evidence in the next bounded run, preserve the requested regeneration,
and do not relax death or encounter limits to approve the release.

The next test-only candidate connects the existing Wizard hunt spacing driver
to collection combat and retains every target/count/death/deadline requirement.
It records bounded read-only resource, enemy and defense observations, each
actual death and post-button recovery, and captures a failure screenshot after
entering the world (not account forms). No game runtime, regeneration, new skill
purchase, grant or reconnect changes. Other classes keep their existing inputs.
Focused checks pass **247 tests / four suites / 3.216s**, changed-file lint and
diff checks pass. Actual revised gameplay and any required follow-up remain open.
