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

## Alpha 1.0.47 package — final checks pending

Distinct **fragments worth finding** patch notes align the login, package,
manifest and deployment/server defaults. The package includes the previously
verified weekly full-bag economy-accounting correction without changing its
payouts. Full predeployment QA now retains the genuinely earned collection
route, using its own disposable character and a separate fresh retry identity.
The route retains the level-one/no-grants assertions and captures the actual
ready-to-turn-in conversation. Contracts pass **237 / 1.721s**, and lint passes.

Final packaged full suites, corrected gameplay and integration remain pending.
Do not publish ahead of the earlier sequential CI/live release gates. Broader
XP/loot tuning, surplus uncollected world drops, physical-phone review and the
eight investigation quests remain open; no completion claim is made for them.
